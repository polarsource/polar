import fs, { writeFile } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import {remark} from 'remark';
import mdx from 'remark-mdx';
import {visit} from 'unist-util-visit';
import GitHubSlugger from 'github-slugger';

const slugger = new GitHubSlugger()

const require = createRequire(import.meta.url);

const openapiSchema = require('@polar-sh/sdk/openapi')

const {absolutePathToPage} = require('next/dist/shared/lib/page-path/absolute-path-to-page')
const { PAGE_TYPES } = require('next/dist/lib/page-types');
const { normalizeAppPath } = require('next/dist/shared/lib/router/utils/app-paths');

const lunr = require('lunr')

const normalizeSchema = (schema) => {
    const result = []
    for (const path in schema.paths) {
        const pathItem = schema.paths[path]
        for (const method in pathItem) {
            const operation = pathItem[method]

            const doc = {
                id: `${path}/${method}`,
                title: operation.summary,
                body: operation.description,
                path: path,
                method
            }

            result.push(doc)
        }
    }
    return result
}


const baseURL = new URL('', import.meta.url).pathname
const docsPath = path.resolve(baseURL, '../../src/app/docs')
const indexOutputPath = path.resolve(baseURL, '../../src/components/CommandPalette/index/searchIndex.json')

function *walkSync(dir, filePredicate) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        if (file.isDirectory()) {
            yield* walkSync(path.join(dir, file.name), filePredicate);
        } else if (filePredicate(file)) {
            yield path.join(dir, file.name);
        }
    }
}

const mdxPredicate = file => file.name.endsWith('.mdx')

const mdxDocuments = []

for (const filePath of walkSync(docsPath, mdxPredicate)) {
    const file = await readFile(filePath);
    const contents = await remark()
        .use(mdx)
        .use(() => (tree) => {
            visit( tree, 'heading', (node) => {
                visit(node, 'text', textNode => {
                    const strippedFilePath = filePath.replace('page.mdx', '')
                    const absolutePath = absolutePathToPage(strippedFilePath, {dir: 'src/app', keepIndex: false, pagesType: PAGE_TYPES.APP, extensions: ['mdx', 'md']})
                    const path = normalizeAppPath(absolutePath)
                    mdxDocuments.push({
                        id: `${path}#${slugger.slug(textNode.value)}`,
                        title: textNode.value,
                        body: textNode.value
                    })
                })
            })
        })
        .process(file);
}


const apiDocuments = normalizeSchema(openapiSchema)

var idx = lunr(function () {
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

    apiDocuments.forEach(function (doc) {
        this.add(doc)
    }, this)

    mdxDocuments.forEach(function (doc) {
        this.add(doc)
    }, this)

})

writeFile(indexOutputPath, JSON.stringify(idx), (err) => {
    if (err) {
        console.error(err)
        process.exit(1)
    }

    console.log('Search index created')
    process.exit(0)
})
