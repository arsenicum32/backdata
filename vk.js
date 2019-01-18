const axios = require('axios');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require("fs"));

module.exports = (app, backURL) => {

  app.get('/auth/:code', async (req,res) => {
    const appId = 5782432;
    const appSecret = "KydQL8NvkB7pbcVA2O9e";
    const redirect_uri = backURL;
    const code = req.params.code;
    const url = `https://oauth.vk.com/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${redirect_uri}&code=${code}`;
    try {
      const { data } = await axios.get(url);
      if(data.access_token){
        const st = await fs.readFileAsync('./creds.json', 'utf8');
        const json = JSON.parse(st);
        json[data.user_id] = data.access_token;
        await fs.writeFileAsync('./creds.json', JSON.stringify(json) , 'utf8');
      }
      res.json({
        url: redirect_uri + '/#/profile/'+ data.user_id,
        cookie: {
          'uid': data.user_id,
          'token': data.access_token
        }
      });
    } catch (e) {
      console.log(e);
      res.json({
        error: true,
        data: e.response && e.response.data
      })
    }
  })


  app.get('/vk/:id/groups', async (req,res) => {
    const st = await fs.readFileAsync('./creds.json', 'utf8');
    const json = JSON.parse(st);
    if(json[req.params.id] && req.query.groups){
      try {
        const { data } = await axios.get("https://api.vk.com/method/groups.getById", {
          params: {
            group_ids: req.query.groups.join(','),
            access_token: json[req.params.id],
            v: 5.92
          }
        })
        res.json(data.response ? data.response : {
          error: true,
          reason: "bad data",
          data
        });
      } catch (e) {
        console.log(e);
        res.json({
          error: true,
          reason: "request error"
        })
      }
    }else{
      res.json({
        error: true,
        reason: "user not found"
      })
    }
  })

  app.get('/vk/ava/:id', async (req,res) => {
    const st = await fs.readFileAsync('./creds.json', 'utf8');
    const json = JSON.parse(st);
    if(json[req.params.id]){
      try {
        const { data } = await axios.get("https://api.vk.com/method/users.get", {
          params: {
            user_id: req.params.id,
            access_token: json[req.params.id],
            v: 5.92,
            fields: "photo_200"
          }
        })
        res.json(data.response ? data.response : {
          error: true,
          reason: "bad data",
          data
        });
      } catch (e) {
        console.log(e);
        res.json({
          error: true,
          reason: "request error"
        })
      }
    }else{
      res.json({
        error: true,
        reason: "user not found"
      })
    }
  })
}
