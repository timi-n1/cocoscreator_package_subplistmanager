// panel/index.js, this filename needs to match the one registered in package.json
Editor.Panel.extend({
  // css style for panel
  style: `
    :host { 
      padding: 4px;
      display: flex;
      flex-direction:column;
    }
    .main-wrap{
      flex:1;
      display:flex;
    }
    .containerbox{
      flex:1;
      display:flex;
      flex-direction:column;
    }
    .line{
      display:flex;
      margin-bottom:4px;
    }
    .label{
      width: 60px;
      text-align: right;
      margin-right: 5px;
      line-height: 20px;
    }
    .fill{
      flex: 1;
    }
    .previewimg{
      flex: 1;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: 50% 50%;
      background-color: #000;
    }
    .box{
      width: 100%;
    }
  `,

  // html template for panel
  template: `
    <div class="main-wrap">
      <ui-box-container class="containerbox">
        <div class="line">
          <span class="label">本地路径</span>
          <ui-input class="fill" :value="cfg[curr].dir" placeholder="路径" disabled readonly></ui-input>
          <ui-button class="cbtn tiny" @click="selectPath()">...</ui-button>
        </div>
        <div class="line">
            <span class="label">输出路径</span>
            <ui-input class="fill" :value="cfg[curr].dest" placeholder="路径" disabled></ui-input>
            <ui-button class="cbtn tiny" @click="selectSavePath()">...</ui-button>
        </div>
        <div class="line">
            <span class="label">最大Size</span>
            <ui-input class="fill" :value="cfg[curr].maxsize.width" placeholder="width" v-on:change="onChangeMaxSizeWidth($event)"></ui-input>
            <ui-input class="fill" :value="cfg[curr].maxsize.height" placeholder="height" v-on:change="onChangeMaxSizeHeight($event)"></ui-input>
        </div>
        <ui-box-container class="previewimg" v-bind:style="{backgroundImage:previewimg}">
            
        </ui-box-container>
      </ui-box-container>
      <ui-box-container class="listbox">
        <ui-button class="box tiny" :class="{blue:index==curr}" v-for="(index,item) in cfg" @click="onselect(index)">{{item.name}}</ui-button>
      </ui-box-container>
    </div>
    <div style="margin-top: 4px;">
        <ui-button class="cbtn green" @click="save">保存</ui-button>
        <ui-button class="cbtn" @click="add">增加图集</ui-button>
        <ui-button class="cbtn red" @click="del">删除</ui-button>
        <ui-button class="cbtn yellow" @click="saveToSubConfig">保存Plist</ui-button>
    </div>
  `,

  // method executed when template and styles are successfully loaded and initialized
  ready () {
    const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const exec = require('child_process').exec;
        const resFile = path.resolve(Editor.projectInfo.path, './assets/lib/subplist-manager.js');
        const cfgFile = path.resolve(Editor.projectInfo.path, './assets-origin/subPlist/0config.json');
        const dtsFile = path.resolve(Editor.projectInfo.path, './typings/subplist-manager.d.ts');
        const templateFile = path.resolve(Editor.projectInfo.path, './packages/subPlist-manager/template.js');
        const templateTxt = fs.readFileSync(templateFile, 'utf-8').toString();

        new window.Vue({
          el: this.shadowRoot,
          data:{
            managerJsonMap:{},
            dtsJsonMap:{},
            cfg:[],
            curr: 0,
            makeCurr: 0,
            previewimg: ''
          },
          created(){
            this.init();
          },
          methods:{
            init(){
              if(fs.existsSync(resFile) ){
                //this.managerJsonMap = require(resFile);
              }

              if(fs.existsSync(cfgFile)){
                this.cfg = JSON.parse(fs.readFileSync(cfgFile).toString());
                this.onselect(0);
              }
            },
            onselect(index){
              this.curr = index;
              if (!this.cfg[this.curr].maxsize) {
                  this.cfg[this.curr].maxsize = {
                      width: 1024,
                      height: 1024
                  };
              }
              this.makeImg(this.curr, true);
            },
            selectPath() {
              const { dialog } = require('electron').remote;
              dialog.showOpenDialog({
                  title: "选择atlas散图所在目录",
                  defaultPath: path.resolve(Editor.projectInfo.path, './assets-origin/subPlist'),
                  properties: ['openDirectory']
              }, (filename) => {
                  if (!filename) {
                      return;
                  }
                  this.cfg[this.curr].dir = filename[0].replace(Editor.projectInfo.path, '.');
                  this.cfg[this.curr].name = path.basename(filename[0]);
                  this.makeImg(this.curr, true);
              });
            },
            selectSavePath() {
              const { dialog } = require('electron').remote;
              dialog.showOpenDialog({
                  title: "选择atlas散图所在目录",
                  defaultPath: path.resolve(Editor.projectInfo.path, this.cfg[this.curr].dest || './assets/'),
                  properties: ['openFile'],
                  filters: [
                      { name: 'plist', extensions: ['plist'] },
                  ]
              }, (filename) => {
                  console.warn(filename);
                  if (!filename) {
                      return;
                  }
                  const ext = path.extname(filename[0]);
                  this.cfg[this.curr].dest = filename[0].replace(Editor.projectInfo.path, '.').replace(ext, '');
              });
            },
            onChangeMaxSizeWidth(evt) {
              this.cfg[this.curr].maxsize.width = parseInt(evt.detail.value, 10);
            },
            onChangeMaxSizeHeight(evt) {
                this.cfg[this.curr].maxsize.height = parseInt(evt.detail.value, 10);
            },
            makeImg(curr, isPreview = false, done=function(){}) {
              this.previewimg = '';
              let app = false;
              if (os.platform() == 'darwin') {
                  app = path.resolve(Editor.projectInfo.path, `./tools/${os.platform()}/TexturePacker.app/Contents/MacOS/TexturePacker`);
              }
              if (os.platform() == 'win32') {
                  app = path.resolve(Editor.projectInfo.path, `./tools/${os.platform()}/bin/TexturePacker.exe`);
              }
              if (!fs.existsSync(app)) {
                  Editor.error('TexturePacker APP不存在');
                  return;
              }
              const data = this.cfg[curr];
              if (!data.dir) {
                  return;
              }
              const outPath = os.tmpdir();
              const outPng = path.resolve(outPath, `out_${Date.now()}.png`);//isPreview ? path.resolve(outPath, `out_${Date.now()}.png`) : `${Editor.projectInfo.path}/${this.cfg[curr].dest}.png`;
              const outPlist = path.resolve(outPath, 'out.json');//isPreview ? path.resolve(outPath, 'out.json') : path.resolve(Editor.projectInfo.path, `${this.cfg[curr].dest}.json`);
              const cmd = `${app} --sheet ${outPng} --data ${outPlist} --allow-free-size --disable-auto-alias --smart-update --trim --padding 2 --extrude 0 --disable-rotation --max-width ${data.maxsize.width} --max-height ${data.maxsize.height} --format json-array ${path.resolve(Editor.projectInfo.path, this.cfg[curr].dir)}`;
              console.warn(cmd);
            

              exec(cmd, (err, stdout, stderr) => {
                  if (stderr) {
                      alert(stderr);
                      console.error(stderr);
                      return;
                  }
                  const showPng = outPng.replace(/\\/g, '/');
                  console.warn(`预览地址=${showPng}`);
                  this.previewimg = `url(file://${showPng})`;
                  if( !isPreview ){
                    var name = this.cfg[curr].name;
                    let pliststr = JSON.parse(fs.readFileSync(outPlist).toString());
                    
                    var meta = pliststr.meta;
                    Editor.log("meta:", meta);
                    var cSize = cc.size(0,0);
                    if(meta){
                      cSize = cc.size(meta.size.w, meta.size.h);
                    }
                    var list = pliststr.frames;
                    var rectJson = {};
                    var rectList = [];
                    for(var i = 0; i < list.length; i++){
                        var item = list[i];   
                        var key = item.filename.replace('.png','');      
                        var itemRect = cc.rect(item.frame.x, item.frame.y, item.frame.w, item.frame.h);             
                        rectJson[key] = itemRect;
                        rectList.push({[key]: itemRect});
                    }
                    this.managerJsonMap[name] = {canvasSize:cSize, rects:rectJson};
                    this.dtsJsonMap[name] = {canvasSize:cSize, rects:rectList};
                    done();
                  }
              });
            },

            makeImgAll(done=function(){}){
              this.makeCurr = 0;
              this._makeImgAll(done);
            },
            _makeImgAll(done=function(){}){
                this.makeImg(this.makeCurr, false, ()=>{
                    this.makeCurr++;
                    Editor.log("1111::", this.makeCurr);
                    if( this.makeCurr < this.cfg.length ){
                        this._makeImgAll(done);
                    }else{
                      Editor.log("000000");
                      done();
                    }
                })
            },
            add() {
                this.cfg.push({
                    name: "test atlas",
                    dir: ""
                });
            },
            saveToSubConfig(){
              this.dtsJsonMap = {};
              this.managerJsonMap = {};
              this.makeImgAll(()=>{
                //js文件
                
                const mapStr = JSON.stringify(this.managerJsonMap, true, 4);
                Editor.log("$$$$$$", mapStr);
                const txt = templateTxt.replace(`'##EventMapHoldPlace##'`, mapStr);
                fs.writeFileSync(resFile, txt);
                //d.ts文件


                let dts = 'declare module cs.SubPlist {\n';
                for(let type in this.dtsJsonMap){
                  dts += this.getTypeDTS(type);
                }
                dts += '}\n';
                fs.writeFileSync(dtsFile, dts);
                Editor.assetdb.refresh('db://assets/lib/subplist-manager.js');
                alert('成功');
              });
            },
            getTypeDTS(type){
              let dts = `\texport var ${type}: {\n\t\t`;
              dts += 'canvasSize:cc.size,\n\t';
              dts += '\trects:{\n\t\t\t';
              const didArr = [];
              let rects = this.dtsJsonMap[type].rects;
              for(let i=0; i<rects.length; i++){
                const itemStr = JSON.stringify(rects[i]);
                var keys = itemStr.split(':');
                var key = keys[0].replace('{','');
                key = key.replace(/"/g,'');
                didArr.push(key);
              }
               dts += didArr.join(': cc.rect,\n\t\t\t');
               dts += ': cc.rect \n\t\t};\n\t};\n';
              return dts;
            },
            del() {
                this.cfg.splice(this.curr, 1);
                this.onselect(0);
            },
            save() {
                fs.writeFileSync(cfgFile, JSON.stringify(this.cfg, null, 4));
                Editor.assetdb.refresh('db://assets/lib/subplist-manager.js');
                Editor.success('成功');
            }
          }
      });
    },
});