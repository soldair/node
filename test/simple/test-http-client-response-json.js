//
// copywrite
//


var common = require('../common');
var assert = require('assert');


var http = require('http');

http.createServer(function(req,res){
  
  res.json({the:'server jsons'});
}).listen(common.PORT);

var c = http.createClient('localhost',common.PORT);

c.json({hello:'json'});

var bufs = [];
c.on('data',function(data){
  bufs.push(data);
});

c.on('end',function(){
  var jsonresponse = Buffer.concat(bufs).toString();
  console.log(jsonresponse);
})

