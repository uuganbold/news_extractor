import puppeteer, {JSONObject} from 'puppeteer';
import * as fs from "fs";
import SiteConfig from "./SiteConfig";
import chalk from 'chalk'

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


type TagInfo={
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
        title:title,
        content:content
    }
}

import program from 'commander';

program
    .option('-i, --input <input>', 'input config file of sites to scrape','sites.json')
    .option('-o, --output <output>', 'output file to save','out.csv')
    .option('-a --append','append to file')
    .option('-b --begin <siteToBegin>','site to begin')
    .option('-s --sites <sites>','sites to process')
    .option('-p --predict <pred>', "page to predict")
    .parse(process.argv);


let confieFile=program.input;
let outFile=program.output;

if(!program.append)
fs.writeFileSync(outFile,"site,url,tagName,left,"+
    "top,width,height,children,textCount,parentCount,fontSize,linkCount,paragraphCount, imageCount,colorRed,colorGreen,colorBlue,backgroundRed,"+
    "backgroundGreen,backgroundBlue,backgroundAlpha,textAlign,marginTop,marginRight,marginBottom,marginLeft,"+
    "paddingTop,paddingRight,paddingBottom,paddingLeft,descendants,title,content");


console.log("reading file:"+confieFile);
const rawData=fs.readFileSync(confieFile);
const config=JSON.parse(rawData.toString()) as Array<SiteConfig>;

(async () => {


    const browser = await puppeteer.launch({
        headless:true,
        args: [
            `--window-size=${ 1920 },${ 1080 }`
        ],
    });

    const page = await browser.newPage();

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

    for(let c of configToProcess){
        console.log(chalk.blueBright('starting to read:'+c.name));
        await page.goto(c.page,
            {
                timeout: 3000000,
                waitUntil: ['load', 'domcontentloaded', 'networkidle2', 'networkidle0']
            });

        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });

        await page.addScriptTag({content:`${parentCount} ${wordCount} ${offset} ${extractTagInformation}`});


        await page.evaluate((c:SiteConfig)=>{

            for (let [selector,type] of [[c.titleSelector,"title"],[c.contentSelector,"content"]]){
                const titleSelectors=selector.split(":");
                let titleElement=document.body;
                let titleNodes=document.querySelectorAll("body");
                for(let selector of titleSelectors){
                    if(isNaN(Number(selector))){
                        titleNodes=titleElement.querySelectorAll(selector);
                        titleElement=titleNodes.item(0);
                    }else{
                        titleElement=titleNodes.item(Number(selector));
                    }
                }
                titleElement.setAttribute("xDataCrawler",type)
            }

        },c as unknown as JSONObject);

        const dimensions = await page.evaluate(() => {
            let elements=document.body.getElementsByTagName("*");
            let result=[];
            for(let i=0;i<elements.length;i++){
                let t=extractTagInformation(elements.item(i) as HTMLElement);
                result.push(t)
            }
            return result;
        });

        dimensions.forEach(d=>{
             try{
                 let line="\n"+c.name+","+c.page.replace(/,/g,'');
                 line+=","+d.tagName;
                 line+=","+d.left;
                 line+=","+d.top;
                 line+=","+d.width;
                 line+=","+d.height;
                 line+=","+d.children;
                 line+=","+d.textCount;
                 line+=","+d.parentCount;
                 line+=","+d.fontSize;
                 line+=","+d.linkCount;
                 line+=","+d.paragraphCount;
                 line+=","+d.imageCount;
                 line+=","+d.colorRed;
                 line+=","+d.colorGreen;
                 line+=","+d.colorBlue;
                 line+=","+d.backgroundRed;
                 line+=","+d.backgroundGreen;
                 line+=","+d.backgroundBlue;
                 line+=","+d.backgroundAlpha;
                 line+=","+d.textAlign;
                 line+=","+d.marginTop;
                 line+=","+d.marginRight;
                 line+=","+d.marginBottom;
                 line+=","+d.marginLeft;
                 line+=","+d.paddingTop;
                 line+=","+d.paddingRight;
                 line+=","+d.paddingBottom;
                 line+=","+d.paddingLeft;
                 line+=","+d.descendants;
                 line+=","+d.title;
                 line+=","+d.content;
                 fs.appendFileSync(outFile,line);
             }catch (e) {
                 console.log(d)
             }

        })

        await page.evaluate(()=>{
            document.querySelectorAll("[xDataCrawler]").forEach(value=>{
                (value as HTMLElement).style.border="red solid";
            })
        })
        await page.screenshot({path:'shots/'+c.name+'.png', fullPage: true});
        console.log(dimensions.length+' elements read');
    }


    await browser.close();
})();