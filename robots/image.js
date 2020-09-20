const google = require('googleapis').google
const customSearch = google.customsearch('v1')
const state = require('./state')

async function robot() {
    const content = state.load()

    await fetchImagesOfAllSentences(content)

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
}

module.exports = robot