// Test the adapter against actual cached PureScript output and the real Webpack resolver.
const assert = require('assert').strict;
const fs = require('fs'), os = require('os'), path = require('path');
const app = path.resolve(__dirname,'../ui-customer');
const webpack = require(require.resolve('webpack',{paths:[app]}));
const babel = require(require.resolve('@babel/core',{paths:[app]}));
const catalog = require(path.join(app,'src/Localization/pt-BR.json'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'yatri-ptbr-'));
const en = path.join(app,'output/Resources.LocalizableV2.EN/index.js');
const home = fs.readFileSync(path.join(app,'output/Screens.HomeScreen.View/index.js'),'utf8');
const transformed = babel.transformSync(home,{configFile:false,babelrc:false,
 filename:path.join(app,'output/Screens.HomeScreen.View/index.js'),
 plugins:[require(path.join(app,'webpack.br-portuguese-babel.cjs'))]}).code;
if (!/localizeLiteral\("Navigation : Button"\)/.test(transformed)) {
 const pos=home.indexOf('Navigation : Button');console.error(home.slice(Math.max(0,pos-200),pos+120));
 throw new Error('actual original Home accessibility literal was not localized');
}
webpack({mode:'none',target:'node',context:app,
 entry:{original:en+'?br-original-locale',localized:en},
 output:{path:temp,filename:'[name].cjs',libraryTarget:'commonjs2'},
 plugins:[require(path.join(app,'webpack.br-portuguese.cjs'))()]},(error,stats)=>{
 try {
  if(error)throw error;
  if(stats.hasErrors())throw new Error(stats.toString({all:false,errors:true}));
  global.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,__YATRI_BR_PT_BR__:true,
   JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatri.debug'})}};
  const original=require(path.join(temp,'original.cjs')).getEn;
  const localized=require(path.join(temp,'localized.cjs')).getEn;
  assert.deepEqual(Object.keys(localized).sort(),Object.keys(original).sort());
  assert.deepEqual(Object.keys(catalog.messages).sort(),Object.keys(original).sort());
  for(const [key,entry] of Object.entries(catalog.messages)){
   assert.equal(typeof original[key],entry.arity?'function':'string',key);
   if(!entry.arity)assert.equal(localized[key],entry.text,key);
   else {let f=localized[key];for(let i=0;i<entry.arity;i++)f=f('TEST_'+i);assert.equal(typeof f,'string',key);}
  }
  assert.equal(window.__YATRI_BR_LOCALIZATION__.locale,'pt-BR');
  global.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,__YATRI_BR_PT_BR__:true,
   JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatri'})}};
  delete require.cache[require.resolve(path.join(temp,'localized.cjs'))];
  const release=require(path.join(temp,'localized.cjs')).getEn;
  for(const [key,entry] of Object.entries(catalog.messages)){
   let a=release[key],b=original[key];
   for(let i=0;i<entry.arity;i++){a=a('TEST_'+i);b=b('TEST_'+i);}
   assert.equal(a,b,key);
  }
  console.log('PASS: actual compiled catalog, real module replacement, original Home literals and production fallback');
 }catch(e){process.exitCode=1;console.error(e);}
 finally{fs.rmSync(temp,{recursive:true,force:true});}
});
