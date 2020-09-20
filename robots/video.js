const fs = require('fs')
const spawn = require('child_process').spawn
const path = require('path')
const rootPath = path.resolve(__dirname, '..')
const gm = require('gm').subClass({
    imageMagick: true
})
const state = require('./state')

async function robot() {
    const content = state.load()

    await convertAllImages(content)
    await createAllSentenceImages(content)
    await createYouTubeThumbnail()
    await renderVideoWithKdenlive()

    async function convertAllImages(content) {
        for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
            await convertImage(sentenceIndex)
        }
    }

    async function convertImage(sentenceIndex) {
        return new Promise((resolve, reject) => {
            const inputFile = `./content/${sentenceIndex}-original.png[0]`
            const outputFile = `./content/${sentenceIndex}-converted.png`
            const width = 1920
            const height = 1080

            gm()
                .in(inputFile)
                .out('(')
                .out('-clone')
                .out('0')
                .out('-background', 'white')
                .out('-blur', '0x9')
                .out('-resize', `${width}x${height}^`)
                .out(')')
                .out('(')
                .out('-clone')
                .out('0')
                .out('-background', 'white')
                .out('-resize', `${width}x${height}`)
                .out(')')
                .out('-delete', '0')
                .out('-gravity', 'center')
                .out('-compose', 'over')
                .out('-composite')
                .out('-extent', `${width}x${height}`)
                .write(outputFile, (error) => {
                    if (error) return reject(error)

                    console.log(`> Image converted: ${inputFile}`)
                    resolve()
                })
        })
    }

    async function createAllSentenceImages(content) {
        for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
            await createSentenceImage(sentenceIndex, content.sentences[sentenceIndex].text)
        }
    }

    async function createSentenceImage(sentenceIndex, sentenceText) {
        return new Promise((resolve, reject) => {
            const outputFile = `./content/${sentenceIndex}-sentence.png`

            const templateSettings = {
                0: {
                    size: '1920x400',
                    gravity: 'center'
                },
                1: {
                    size: '1920x1080',
                    gravity: 'center'
                },
                2: {
                    size: '800x1080',
                    gravity: 'west'
                },
                3: {
                    size: '1920x400',
                    gravity: 'center'
                },
                4: {
                    size: '1920x1080',
                    gravity: 'center'
                },
                5: {
                    size: '800x1080',
                    gravity: 'west'
                },
                6: {
                    size: '1920x400',
                    gravity: 'center'
                },
            }

            gm()
                .out('-size', templateSettings[sentenceIndex].size)
                .out('-gravity', templateSettings[sentenceIndex].gravity)
                .out('-background', 'transparent')
                .out('-fill', 'white')
                .out('-kerning', '-1')
                .out(`caption:${sentenceText}`)
                .write(outputFile, (error) => {
                    if (error) return reject(error)

                    console.log(`> Sentence created: ${outputFile}`)
                    resolve()
                })
        })
    }

    async function createYouTubeThumbnail() {
        return new Promise((resolve, reject) => {
            gm()
                .in('./content/0-converted.png')
                .write('./content/youtube-thumbnail.jpg', (error) => {
                    if (error) return reject(error)

                    console.log(`> Create YouTube thumbnail`)
                    resolve()
                })
        })
    }

    async function renderVideoWithKdenlive() {
        return new Promise((resolve, reject) => {
            const inputRenderFile = `${rootPath}/default-render.mlt`
            const outputRenderFile = `${rootPath}/content/default-render.mlt`
            const meltFilePath = `/usr/bin/melt`

            const buffer = fs.readFileSync(inputRenderFile, 'utf-8')
            const renderFileBuffer = buffer
                .replace(/project_path/g, rootPath)
                .replace(/main_title/g, content.searchTerm)
                .replace(/output_path/g, `${rootPath}/content/output.mp4`)

            fs.writeFileSync(outputRenderFile, renderFileBuffer)

            const render = spawn('xvfb-run', [
                '-a',
                meltFilePath,
                outputRenderFile
            ])

            render.stdout.on('data', data => {
                process.stdout.write(data)
            })

            render.stderr.on('data', data => {
                process.stderr.write(data)
            })

            render.on('close', () => {
                console.log('> Render process finished')
                resolve()
            })
        })
    }
}

module.exports = robot