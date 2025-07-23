# Ref2Link  

The core engine of <b>Ref2Link</b>. Contains the follwing components:
  * Javascript engine library
  * Rule compiler
  * Core rule set (EU/ES/FR)

<br>

## Installation
Requirements:
  * NodeJS 10+  (v10.15.0)
  * Yarn        (v1.21.1)

```
yarn install
```

<br>

## Compile runtime rules
Based on the XML rules found in the `/rules/` directory, we create a JSON file which contains the base64 encoded rules data. This file will be used as input for the final bundle.

```
# Default (multi-lingual) compilation
yarn run compile --output=data/rules.json

# For language-specific rule compilation
yarn run compile --language=ES --output=data/rules.ES.json
```
<br>

## Create script bundle
Injects the rules data from `data/rules.json` into our JS engine and creates a self-contained, ready-to-use bundle script.

```
# Inject global rules
yarn run bundle --input=data/rules.json --output=dist/ref2link.bundle.js

# For language-specific compilation
yarn run bundle --input=data/rules.ES.json --output=dist/ref2link.ES.bundle.js
```
<br>

## Inject language-specific rules at runtime (API)
Language-specific configuration (rules) can also be injected from a `rules.json` file.
```
R2L.addRules(rulesObj)    # Object from rules.json 
```
<br>

## Command-line processing
By default the batch tool uses the multi-lingual rule set (`data/rules.json`). This can be configured using the `--langsource` argument.
```
node ./bin/ref2link --inputtext="Verordnung (EU) Nr. 345/2013" --langsource=DE // writes to stdout

node ./bin/ref2link --input="./tests/input/test.txt" // reads input from file

node ./bin/ref2link --inputdir="./tests/input" --outputdir="./tests/output" // will process all files found inside the directory and write them to the output directory

node ./bin/ref2table --input="./tests/input/test.txt" --format=xml --output="./tests/output/result.xml"  // writes result to file

node ./bin/ref2table --inputtext="C-99/99" --format=json --environment=SJ-PRD // set environments
```
#### Arguments
```
    --inputtext       Text to process                                     
    --input           Path to input file                                   
    --inputdir        Path to input dir - Will process all files inside  
    --output          Path to output file                                 
    --outputdir       Path to output dir - Used with `inputdir`
    --langsource      Use language specific rules [ISO2] (default=MULTI)
    --langtarget      Provide tailored target urls [ISO2]
    --format          Ref2Table output format [json/xml] (default=json)       
    --environment     Comma-separated environments to use (default=*)
    --ruletype        Comma-separated rules to use
    --target          Comma-separated targets to use
    --excludetarget   Comma-separated targets to be excluded
    --linkeddata      Enable Linked data (default=false)
    --linkeddatamode  Linked data settings (default=all) 
                      Example: check-exist,seq-number,metadata,all
    --htmlmode        Parse input as HTML (default=false)
                      Only replace text nodes - will preserve HTML attributes,
                      existing links, comments etc.           
    --strictrules     Comma-separated rules to mark as strict. Only available for
                      `eurlex.act`. Example usage: strictrules=eurlex.act
    --pointintime     Use ELI Point in time. Format: YYYY-MM-DD. defaults to `/oj`

```
<br>

## Demo

See the `evaluation_kit/demo.html` page for web integration.


<br>

## Tests

Run the test suite

```
yarn run test
```
<br>