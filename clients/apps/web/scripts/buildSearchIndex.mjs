import fs, { readFileSync, writeFile } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import GitHubSlugger from 'github-slugger';

const require = createRequire(import.meta.url);
const lunr = require('lunr')

const baseURL = new URL('', import.meta.url).pathname

const metadata = JSON.parse(readFileSync(path.resolve(baseURL, '../../src/components/CommandPalette/index/searchMetadata.json'), 'utf8'))

const idx = lunr(function () {
    this.ref('id')
    this.field('title')
    this.field('body')
    this.field('path')
    this.field('method')

    this.pipeline.remove(lunr.stemmer)
    this.pipeline.remove(lunr.trimmer)
    this.pipeline.remove(lunr.stopWordFilter)
    this.searchPipeline.remove(lunr.stemmer)
    this.searchPipeline.remove(lunr.trimmer)
    this.searchPipeline.remove(lunr.stopWordFilter)

    const docs = [
        ...metadata.openapi,
        ...metadata.docs,
    ]

    docs.forEach(function (doc) {
        this.add(doc)
    }, this)
})


const indexOutputPath = path.resolve(baseURL, '../../src/components/CommandPalette/index/searchIndex.json')

writeFile(indexOutputPath, JSON.stringify(idx), (err) => {
    if (err) {
        console.error(err)
        process.exit(1)
    }

    console.log('Search index created')
    process.exit(0)
})
