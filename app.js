const Promise = require('bluebird');
const fs = Promise.promisifyAll(require("fs"));
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const axios = require('axios');

const interests = JSON.parse(fs.readFileSync('./interests.json','utf8'));
const common = JSON.parse(fs.readFileSync('./common.json'));
const types = JSON.parse(fs.readFileSync('./types.json'));

const back = axios.create({
  baseURL: "https://api.datafuel.ru",
  auth: {
    username: 'littlebrobot',
    password: 'asdf1234zxcvlb'
  }
});
const SETUP = JSON.parse(fs.readFileSync('./SETUP.json'));
app.set('port', SETUP.port );
const domainName = SETUP.env == "DEV" ? `http://localhost:${app.get('port')}` : SETUP.frontURL;

app.use(cors());
app.use(cookieParser());
app.use('/interests', express.static('interests'));

app.get('/', (req, res) => res.json(req.cookies.uid) );

require('./vk')(app, SETUP.env == "DEV" ? "http://localhost:8080" : SETUP.backURL );

app.get('/test', async (req, res) => {
  try {
    const { data } = await back.get('/me');
    res.json(data);
  } catch (err){
    res.json({
      error: err.errno,
      status: err && err.response && err.response.status || "unhandled reason"
    });
  }
});

app.get('/teststat/:id', async (req, res) => {
  const has = await fs.existsSync('./users/'+req.params.id + '.json');
  if(has && !req.query.nocache){
    const r = await fs.readFileAsync('./users/'+req.params.id + '.json', 'utf8')
    return res.json({
      ...JSON.parse(r),
      cache: true
    })
  }
  try {
    const { data } = await back.post('/stats/users', {
      "ids": [
        parseInt(req.params.id)
      ],
      "filters": {
        // "age_bounds": [
        //   {
        //     "from": 0,
        //     "to": 0
        //   }
        // ],
        // "city_ids": [
        //   0
        // ],
        // "country_ids": [
        //   0
        // ],
        // "sex": [
        //   "male"
        // ],
        // "MBTIs": [
        //   "ISTJ"
        // ]
      }
    });

    const failPrint = () => res.json({
      error: true,
      reason: "bad data",
      data
    });
    // res.json(data);
    if( !data["MBTI"] ) return failPrint();

    const d = data["MBTI"]["types_distribution"];
    const bd = data["MBTI"]["basis_distribution"];
    const keys = d && Object.keys(d).filter( t => d[t] === 1 );

    if(!bd || !d) return failPrint();
    if( keys.length == 0 ) return failPrint();
    if( !types[keys[0]] ) return failPrint();
    if( !data["topn_groups"] ) return failPrint();

    let bd_v = Object.keys(bd).map( k => bd[k].mean || 0 );

    const getMax = (ar) => {
      let i = 0; let m = 0;
      ar.forEach( (v, index) => v > m ? i = index : null );
      return i;
    }

    const gt = (a,b,c,d) => {
      return Math.min( ( bd.IE.mean || 0) /100*a + (bd.SN.mean||0)/100*b + (bd.TF.mean||0)/100*c + (bd.JP.mean||0)/100*d , 1 )
    }
    let result = {
      name: common[ Math.min(common.length , getMax(bd_v)) ].name ,
      desc: common[ Math.min(common.length , getMax(bd_v)) ].desc ,
      ava: "",
      type: `Тип ${keys[0]} (${types[keys[0]].name})`,
      typedesc: types[keys[0]].desc,
      metrics: [
        {
          text: "Общительность",
          value: gt(.2,.2,.2,1)
        },
        {
          text: "Задумчивость",
          value: gt(.2,.4,.4,1)
        },
        {
          text: "Дружелюбие",
          value: gt(.2,.3,.2,.3)
        },
        {
          text: "Планирование",
          value: gt(.2,1,1,.4)
        },
        {
          text: "Внимательность",
          value: gt(.3,.1,.1,.3)
        },
        {
          text: "Мечтательность",
          value: gt(.2,.1,.1,.4)
        },
        {
          text: "Рассчетливость",
          value: gt(.3,.3,.2,.2)
        },
        {
          text: "Гибкость",
          value: gt(.3,.3,1,.4)
        }
      ],
      top: data["topn_groups"].map( g => g.id )
    }
    const rs = await axios.get(domainName + '/vk/ava/'+req.params.id);
    const rg = await axios.get( domainName + '/vk/'+req.params.id  + '/groups', { params: {
      groups: data["topn_groups"].map( g => g.id )
    }});
    if(rs.data && rs.data[0])
      result.ava = rs.data[0].photo_200;
    if(rg.data && rg.data.length)
      result.top = rg.data.map( public => ({
        name: public.name,
        ava: public.photo_200
      }))

    await fs.writeFileAsync('./users/'+req.params.id + '.json', JSON.stringify(result, null,'\t'),'utf8');
    res.json(result);
  } catch (err){
    console.log(err);
    res.json({
      error: err.errno,
      status: err && err.response && err.response.status || "unhandled reason"
    });
  }
});



app.get('/login', (req,res) => {
  res.cookie('uid', '_token');
  res.json({ status: true })
});
app.get('/logout', (req,res) => {
  res.cookie('uid', '');
  res.json({ status: true });
});

app.get('/getin', (req, res) => res.json(
  interests.map( (e,i)=> ({
    name: e,
    index:i,
    path: `${domainName}/interests/${i}.png`
  }) ).filter(e => e.name && (req.query.id ?
    typeof req.query.id === typeof [] ?
    req.query.id.map(d=>parseInt(d)).includes(e.index)
    : e.index == req.query.id
    : true))
));

app.listen( app.get('port') , () => console.log('Example app listening on port 7000!'));
