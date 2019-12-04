import puppeteer, {Browser, JSONArray, JSONObject, Page} from 'puppeteer';
import * as fs from "fs";
import SiteConfig from "./SiteConfig";
import chalk from 'chalk'
import program from 'commander';

function offset(el:HTMLElement):{top:number,left:number}{
    let rect = el.getBoundingClientRect();
    let scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return { top: rect.top + scrollTop, left: rect.left + scrollLeft }
};

function wordCount(str:string):number{
    let wC:number=0;
    let tokens=str.split(" ");
    for(let i=0;i<tokens.length;i++){
        let t:string=tokens[i];
        t=t.trim();
        if(t.length>0) ++wC;
    }
    return wC;
};

function parentCount(el: HTMLElement):number{
    let count=0;
    let parent:HTMLElement=el;
    while(parent.tagName!="BODY"){
        ++count;
        parent=parent.parentElement;
    }
    return count;
}

const TagInfoNames=['tagName','left','top','width','height','children','textCount','parentCount',
    'fontSize','linkCount','paragraphCount','imageCount','colorRed','colorGreen','colorBlue',
    'backgroundRed','backgroundGreen','backgroundBlue','backgroundAlpha','textAlign','marginTop',
    'marginRight','marginBottom','marginLeft','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'descendants','relPosX','relPosY'];
type TagInfo={
    crawlerId:string|null,
    tagName:string,
    left:number,
    top:number,
    width:number,
    height:number,
    children:number,
    textCount:number,
    parentCount:number,
    fontSize:number,
    linkCount:number,
    paragraphCount:number,
    imageCount:number,
    colorRed:number,
    colorGreen:number,
    colorBlue:number,
    backgroundRed:number,
    backgroundGreen:number,
    backgroundBlue:number
    backgroundAlpha:number,
    textAlign:string,
    marginTop:number,
    marginRight:number,
    marginBottom:number,
    marginLeft:number,
    paddingTop:number,
    paddingRight:number,
    paddingBottom:number,
    paddingLeft:number,
    descendants:number,
    relPosX:number,
    relPosY:number,
    title:boolean,
    content:boolean
}
function extractTagInformation(el:HTMLElement):TagInfo{
    const off=offset(el);
    const fontSize=window.getComputedStyle(el).fontSize.replace(/px/g,'') as unknown as number;
    let color=window.getComputedStyle(el).color;
    color=color.substring(color.indexOf("(")+1,color.indexOf(")"));
    const colorArray=color.split(",");

    let background=window.getComputedStyle(el).backgroundColor;
    background=background.substring(background.indexOf("(")+1,background.indexOf(")"));
    const backgroundArray=background.split(",");

    const align=window.getComputedStyle(el).textAlign;

    const marginTop=window.getComputedStyle(el).marginTop.replace(/px/g,"") as unknown as number;
    const marginRight=window.getComputedStyle(el).marginRight.replace(/px/g,"") as unknown  as number;
    const marginBottom=window.getComputedStyle(el).marginBottom.replace(/px/g,"") as unknown  as number;
    const marginLeft=window.getComputedStyle(el).marginLeft.replace(/px/g,"") as unknown  as number;

    const paddingTop=window.getComputedStyle(el).paddingTop.replace(/px/g,"") as unknown  as number;
    const paddingRight=window.getComputedStyle(el).paddingRight.replace(/px/g,"") as unknown  as number;
    const paddingBottom=window.getComputedStyle(el).paddingBottom.replace(/px/g,"") as unknown  as number;
    const paddingLeft=window.getComputedStyle(el).paddingLeft.replace(/px/g,"") as unknown  as number;

    let title=false;
    let content=false;
    if(el.hasAttribute("xDataCrawler")){
        const xDataAttr=el.getAttribute("xDataCrawler");
        if(xDataAttr==="title"){
            title=true;
        }else if(xDataAttr==="content"){
            content=true;
        }
    }
    return {
        crawlerId:null,
        tagName:el.tagName,
        left:off.left,
        top:off.top,
        width:el.scrollWidth,
        height:el.scrollHeight,
        children:el.childElementCount,
        textCount:wordCount(el.textContent),
        parentCount:parentCount(el),
        fontSize:fontSize,
        linkCount:el.getElementsByTagName("a").length,
        paragraphCount:el.getElementsByTagName("p").length,
        imageCount:el.getElementsByTagName("img").length,
        colorRed:Number(colorArray[0]),
        colorGreen:Number(colorArray[1]),
        colorBlue:Number(colorArray[2]),
        backgroundRed:Number(backgroundArray[0]),
        backgroundGreen:Number(backgroundArray[1]),
        backgroundBlue:Number(backgroundArray[2]),
        backgroundAlpha:backgroundArray.length>3?Number(backgroundArray[3]):1,
        textAlign:align,
        marginTop:marginTop,
        marginRight:marginRight,
        marginBottom:marginBottom,
        marginLeft:marginLeft,
        paddingTop:paddingTop,
        paddingRight:paddingRight,
        paddingBottom:paddingBottom,
        paddingLeft:paddingLeft,
        descendants:el.getElementsByTagName("*").length,
        relPosX:off.left/el.ownerDocument.body.scrollWidth,
        relPosY:off.top/el.ownerDocument.body.scrollHeight,
        title:title,
        content:content
    }
}

const _openBrower=async ():Promise<Page>=>{
    const browser = await puppeteer.launch({
        headless:true,
        args: [
            `--window-size=${ 1920 },${ 1080 }`
        ],
    });

    return browser.newPage();
};

const _openWebPage=async (page:Page,url:string)=>{
    await page.goto(url,
        {
            timeout: 60000,
            waitUntil: ['load', 'domcontentloaded']
        });

    await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
    });

    await page.addScriptTag({content:`${parentCount} ${wordCount} ${offset} ${extractTagInformation}`});

};

const _tagTitleContents=async (page:Page,titleSelectors:string[],contentSelectors:string[])=>{
    let specialTags:string[][]=[];
    specialTags=specialTags.concat(titleSelectors.map(t=>[t,'title']));
    specialTags=specialTags.concat(contentSelectors.map(t=>[t,'content']));

    await page.evaluate((specialTags:string[][])=>{

        for (let [selector,type] of specialTags){
            const selectors=selector.split(":");
            let titleElement=document.body;
            let titleNodes=document.querySelectorAll("body");
            for(let selector of selectors){
                if(isNaN(Number(selector))){
                    titleNodes=titleElement.querySelectorAll(selector);
                    titleElement=titleNodes.item(0);
                }else{
                    titleElement=titleNodes.item(Number(selector));
                }
            }
            if(titleElement!=null)
            titleElement.setAttribute("xDataCrawler",type)
        }

    },specialTags);
};

const _readElementsInfo=async (page:Page):Promise<TagInfo[]>=>{
    const dimensions = await page.evaluate(() => {
        let elements=document.body.getElementsByTagName("*");
        let result=[];
        for(let i=0;i<elements.length;i++){
            const htmlEl=elements.item(i) as HTMLElement;
            let t=extractTagInformation(htmlEl);
            htmlEl.setAttribute("xDataCrawler-id",String(i));
            t.crawlerId=(String(i));
            result.push(t)
        }
        return result;
    });
    return dimensions;
};

const _saveShots=async (page:Page, path:string)=>{
    await page.evaluate(()=>{
        document.querySelectorAll("[xDataCrawler]").forEach(value=>{
            const htmlEl=value as HTMLElement;
            if(htmlEl.getAttribute("xDataCrawler")==='title'){
                htmlEl.style.border="blue solid";
            }else htmlEl.style.border="red solid";
        })
    })
    await page.screenshot({path:path, fullPage: true});
}

import {spawn} from 'child_process'
import PredictConfig from "./PredictConfig";
const url_func= require('url');

const _predictUrl=async (urls:Array<[string,string]>,i:number,page:Page)=>{
    if(i>=urls.length){
        await page.browser().close();
        return;
    }

    try{

        let u=urls[i];
        let dimentions:TagInfo[];
        console.log("starting:"+u[0]);
        const pythonProcess = spawn('python3',["../classifier/predictor.py"]);

        pythonProcess.stdout.on('data', async (data) => {
            data=data.toString();
            console.log(data);

            const title=data.substring(data.indexOf('[',data.indexOf('title:'))+1,
                data.indexOf(']',data.indexOf('title:')));

            const content=data.substring(data.indexOf('[',data.indexOf('content:'))+1,
                data.indexOf(']',data.indexOf('content:')));

            if(program.shots){
                const titleSelector="[xDataCrawler-id='"+parseInt(title)+"']";
                const contentSelector="[xDataCrawler-id='"+parseInt(content)+"']";
                //console.log(titleSelector);
                //console.log(contentSelector);
                await _tagTitleContents(page,[titleSelector],[contentSelector]);
                await _saveShots(page,program.shots+"/"+u[0]+".png");
            }

            await _predictUrl(urls,i+1,page);
        });

        pythonProcess.stderr.on('data', async (data) => {
            console.error(`stderr: ${data}`);
            await page.browser().close();
        });
        await _openWebPage(page,u[1]);

        dimentions=await _readElementsInfo(page);

        let line='crawlerId';
        TagInfoNames.forEach(t=>line+=","+t);
        pythonProcess.stdin.write(line+'\n');
        dimentions.forEach(d=>{
            let line=d.crawlerId;
            // @ts-ignore
            TagInfoNames.forEach(t=>line+=","+d[t]);
            pythonProcess.stdin.write(line+'\n');
        });
        pythonProcess.stdin.end();
    }catch (e) {
        console.error(e);
        await _predictUrl(urls,i+1,page);
    }

};
const _predict=()=>{

        let urls:Array<[string,string]>=[];
        if(program.predict==='bulk'){
            let configFile=program.input;
            console.log("reading file:"+configFile);
            const rawData=fs.readFileSync(configFile);
            const config=JSON.parse(rawData.toString()) as Array<PredictConfig>;
            for (let c of config) {
                urls.push([c.name, c.page]);
            }
        }else{
            const u=url_func.parse(program.predict,true);
            urls.push([u.hostname+Math.floor(Math.random()*1000),program.predict]);
        }

        (async ()=>{
            const page=await _openBrower();

            await _predictUrl(urls,0,page);

        })();
};

const _testUrl=async (configToProcess: Array<SiteConfig>, i: number, titleStat:number,contentStat:number,page: Page)=>{
    if(i>=configToProcess.length){
        await page.browser().close();
        console.log("####### FINISHED TESTING ########");
        console.log("TITLE: "+titleStat+"/"+configToProcess.length+", ("+(titleStat/configToProcess.length)+")");
        console.log("CONTENT: "+contentStat+"/"+configToProcess.length+", ("+(contentStat/configToProcess.length)+")");
        process.exit();
    }

    try{

        let u=configToProcess[i];
        console.log("starting:"+u.name);
        let titleId="";
        let contentId="";
        const pythonProcess = spawn('python3',["../classifier/predictor.py"]);

        pythonProcess.stdout.on('data', async (data) => {
            data=data.toString();
            console.log(data);

            const title=data.substring(data.indexOf('[',data.indexOf('title:'))+1,
                data.indexOf(']',data.indexOf('title:')));

            const content=data.substring(data.indexOf('[',data.indexOf('content:'))+1,
                data.indexOf(']',data.indexOf('content:')));

            console.log(u.name+"--> title:"+(titleId===title.trim())+",  content:"+(contentId===content.trim()));

            if(program.shots){
                const titleSelector="[xDataCrawler-id='"+parseInt(title)+"']";
                const contentSelector="[xDataCrawler-id='"+parseInt(content)+"']";
                await _tagTitleContents(page,[titleSelector],[contentSelector]);
                await _saveShots(page,program.shots+"/"+u.name+".png");
            }
            let newTitleStat=titleStat+((titleId==title.trim())?1:0);
            let newContentStat=contentStat+((contentId==content.trim())?1:0);
            await _testUrl(configToProcess,i+1,newTitleStat,newContentStat,page);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
            page.browser().close();
        });
        await _openWebPage(page,u.page);
        console.log("opened web page");
        await _tagTitleContents(page,[u.titleSelector],[u.contentSelector]);

        const dimentions=await _readElementsInfo(page);

        let line='crawlerId';
        TagInfoNames.forEach(t=>line+=","+t);
        pythonProcess.stdin.write(line+'\n');
        dimentions.forEach(d=>{
            let line=d.crawlerId;
            // @ts-ignore
            TagInfoNames.forEach(t=>line+=","+d[t]);
            pythonProcess.stdin.write(line+'\n');
            if(d.title) titleId=d.crawlerId;
            if(d.content) contentId=d.crawlerId;
        });
        pythonProcess.stdin.end();
    }catch (e) {
        console.error(e);
        await _testUrl(configToProcess,i+1,titleStat,contentStat,page);
    }
};

const _test=()=>{
    let confieFile=program.input;

    console.log("reading file:"+confieFile);
    const rawData=fs.readFileSync(confieFile);
    const config=JSON.parse(rawData.toString()) as Array<SiteConfig>;

    let configToProcess=config;
    if(program.begin){
        configToProcess=[];
        let begined=false;
        for(let c of config){
            if(begined) configToProcess.push(c);
            else if(c.name===program.begin){
                configToProcess.push(c);
                begined=true;
            }
        }
    }else
    if(program.sites){
        const sitesToProcess:Array<string>=program.sites.split(",");
        configToProcess=[];
        sitesToProcess.forEach(s=>{
            for(let c of config){
                if(c.name===s){
                    configToProcess.push(c);
                    break;
                }
            }
        })
    }

    (async () => {

        const page=await _openBrower();

        await _testUrl(configToProcess,0,0,0,page);

    })();
};

const _collectInfo=()=>{
    let confieFile=program.input;
    let outFile=program.output;

    if(!program.append){
        let header="site,url";
        TagInfoNames.forEach(t=>header+=","+t);
        header+=",title,content";
        fs.writeFileSync(outFile,header);
    }

    console.log("reading file:"+confieFile);
    const rawData=fs.readFileSync(confieFile);
    const config=JSON.parse(rawData.toString()) as Array<SiteConfig>;

    let configToProcess=config;
    if(program.begin){
        configToProcess=[];
        let begined=false;
        for(let c of config){
            if(begined) configToProcess.push(c);
            else if(c.name===program.begin){
                configToProcess.push(c);
                begined=true;
            }
        }
    }else
    if(program.sites){
        const sitesToProcess:Array<string>=program.sites.split(",");
        configToProcess=[];
        sitesToProcess.forEach(s=>{
            for(let c of config){
                if(c.name===s){
                    configToProcess.push(c);
                    break;
                }
            }
        })
    }

    (async () => {

        const page=await _openBrower();

        for(let c of configToProcess){
            console.log(chalk.blueBright('starting to read:'+c.name));

            await _openWebPage(page,c.page);

            await _tagTitleContents(page,[c.titleSelector],[c.contentSelector]);

            const dimentions=await _readElementsInfo(page);

            dimentions.forEach(d=>{
                try{
                    let line="\n"+c.name+","+c.page.replace(/,/g,'');
                    // @ts-ignore
                    TagInfoNames.forEach(t=>line+=","+d[t]);
                    line+=","+d.title;
                    line+=","+d.content;
                    fs.appendFileSync(outFile,line);
                }catch (e) {
                    console.log(d)
                }

            });

            if(program.shots){
                await _saveShots(page,program.shots+'/'+c.name+'.png');
            }

            console.log(dimentions.length+' elements read');
        }

        page.browser().close();
    })();
};



program
    .option('-i, --input <input>', 'input config file of sites to scrape','sites.json')
    .option('-o, --output <output>', 'output file to save','out.csv')
    .option('-a --append','append to file')
    .option('-t --test','start to testing')
    .option('-b --begin <siteToBegin>','site to begin')
    .option('-s --sites <sites>','sites to process')
    .option('-p --predict <predict>', "page to predict")
    .option('-h --shots <shots>',"directory to save screenshots")
    .parse(process.argv);
if(program.predict){
    _predict();
}else if(program.test){
    _test();
}else{
    _collectInfo();
}

