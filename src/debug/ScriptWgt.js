define([
  "dojo/_base/declare"
  , "dojo/Deferred"
  , "dojo/has"
  , "sol/promise"
  , "dojo/_base/array"
  , "dojo/_base/lang"
  , "sol/string"
  , "main/clientOnly!dijit/form/Button"
  , "main/clientOnly!dijit/form/ToggleButton"
  , "modules/JavaScript"
  , "debug/mode"
], function(
  declare
  , Deferred
  , has
  , solPromise
  , array
  , lang
  , solString
  , Button
  , ToggleButton
  , JavaScript
  , debugMode
){
  
  return declare([JavaScript], {
    "class": "debug javascript"
    
    , buildRendering: function(){
      var ret = this.inherited(arguments);
      
      this.jshintBtn.onChange = lang.hitch(this, function(){
        this.mirror.set("jshint", this.jshintBtn.get("checked"));
      });
      this.jshintBtn.set("checked", false);
      
      this.mirror.set("jshint", false);
      
      this.continueBtn = this.ownObj(new Button({
        onClick: lang.hitch(this, "_continue", undefined)
        , label: "continue"
      }));
      this.menu.addChild(this.continueBtn);
      
      this.stepInBtn = this.ownObj(new Button({
        onClick: lang.hitch(this, "_continue", "in")
        , label: "step in"
      })); 
      this.menu.addChild(this.stepInBtn);
      
      this.stepNextBtn = this.ownObj(new Button({
        onClick: lang.hitch(this, "_continue", "next")
        , label: "next"
      })); 
      this.menu.addChild(this.stepNextBtn);
      
      this.stepOutBtn = this.ownObj(new Button({
        onClick: lang.hitch(this, "_continue", "out")
        , label: "step out"
      })); 
      this.menu.addChild(this.stepOutBtn);
      
      return ret;
    }
    
    , _continue: function(parStep){
      this.debuggerObj.cont(parStep).then(lang.hitch(this, function(par){
        debugger;
      }));
    }
    
    , constructor: function(par){
      this.promise = new Deferred();
      this.debuggerObj = par.debuggerObj;
      this.script = par.script;
      this.content = {
        text: "loading code ..."
      };
      this.par = {
        contentType: "text/javaScript"
        , id: this.script.name
      };
      
      this.debuggerObj.getSource(this.script).then(lang.hitch(this, function(par){
        this.mirror.set("value", par.source);
        this.promise.resolve(this);
      }));
    }
    
    , breakPoint: function(parData){
      /*
      invocationText: "#<Server>.[anonymous](req=#<IncomingMessage>, res=#<ServerResponse>)"
script: Object
sourceColumn: 2
sourceLine: 3
sourceLineText: "  debugger;"
__proto__: Object
*/
      //debugger;
      this.mirror.set("mode", {
        name: "debugging"
        , line: parData.sourceLine
        , col: parData.sourceColumn
        , length: parData.sourceLineText.length - parData.sourceColumn
      });
    }
    
    
  });
});
