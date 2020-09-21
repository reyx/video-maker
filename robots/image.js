const google = require('googleapis').google
const imageDownloader = require('image-downloader')
const customSearch = google.customsearch('v1')
const state = require('./state')

async function robot() {
    const content = state.load()

    await fetchImagesOfAllSentences(content)
    await downloadAllImages(content)

    state.save(content)

    async function fetchImagesOfAllSentences(content) {
        for (const sentence of content.sentences) {
            const query = `${content.searchTerm} ${sentence.keywords[0]}`
            sentence.images = await fetchGoogleAndReturnImageLinks(query)

            sentence.googleSearchQuery = query
        }
    }

    async function fetchGoogleAndReturnImageLinks(query) {
        const response = await customSearch.cse.list({
            auth: process.env.GOOGLE_SEARCH_APIKEY,
            cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
            q: query,
            searchType: 'image',
            num: 2
        })

        const imagesUrl = response.data.items.map(item => item.link)

        return imagesUrl
    }

    async function downloadAllImages(content) {
        content.downloadedImages = []

        for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
            const images = content.sentences[sentenceIndex].images

            for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
                const imageUrl = images[imageIndex]

                try {
                    if (content.downloadedImages.includes(imageUrl)) {
                        throw new Error('Image already downloaded')
                    }
                    await downloadAndSave(imageUrl, `${sentenceIndex}-original.png`)
                    content.downloadedImages.push(imageUrl)
                    console.log(`> [${sentenceIndex}][${imageIndex}] Image downloaded: ${imageUrl}`)
                    break
                } catch (error) {
                    console.log(`> [${sentenceIndex}][${imageIndex}] Failed to download image ${imageUrl}: ${error}`)
                }
            }
        }
    }

    async function downloadAndSave(url, fileName) {
        return imageDownloader.image({
            url,
            dest: `./content/${fileName}`
        })
    }
}

module.exports = robot