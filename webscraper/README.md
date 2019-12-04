# Web scraper

This module will be used to build a dataset on which main content extractor classifier would be trained.
And also with this module you can use my model

## Installation

It is node.js app and yarn is used as dependency management tool. So you need to have node.js and yarn installed on you machine.

To install dependencies.
```shell script
yarn install
```

To build source code.
```shell script
yarn build
```

### Usage

To test any web url
```shell script
yarn start -p http://www.a.com/news/1000 -h folder
```
This command will highlight the title and main content and save the screenshot into the **folder**

Or you can test several web site at once
```shell script
yarn start -p bulk -i predict.json -h folder
```
This command will highlight the title and main content of all websites listed in **predict.json** and save the screenshots into the **folder**

The input file should be similar to [predict.json](predict.json)

