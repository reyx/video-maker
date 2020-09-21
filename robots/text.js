const to = require('await-to-js').to
const algorithmia = require('algorithmia')
const sentenceBoundaryDetection = require('sbd')
const state = require('./state')
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1')
const IamAuthenticator = require('ibm-watson/auth').IamAuthenticator

async function robot() {
    const content = state.load()

    await fetchContentFromWikipedia(content)
    sanitizeContent(content)
    breakContentIntoSentences(content)
    limitMaximumSentences(content)
    await fetchKeywordOfAllSentences(content)

    state.save(content)

    async function fetchContentFromWikipedia(content) {
        try {
            const algorithmiaAuthenticated = algorithmia(process.env.ALGORITHMIA_APIKEY)
            const wikipediaAlgorithm = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2?timeout=500')
            const wikipediaResponse = await wikipediaAlgorithm.pipe({
                articleName: content.searchTerm,
                lang: content.lang
            })
            const wikipediaContent = wikipediaResponse.get()
            content.sourceContentOriginal = wikipediaContent.content
        } catch (err) {
            throw err
        }
    }

    function sanitizeContent(content) {
        const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
        const withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)

        content.sourceContentSanitized = withoutDatesInParentheses

        function removeBlankLinesAndMarkdown(text) {
            const allLines = text.split('\n')

            const withoutBlankLinesAndMarkdown = allLines.filter(line => {
                return line.trim().length && !line.trim().startsWith('=')
            })

            return withoutBlankLinesAndMarkdown.join(' ')
        }

        function removeDatesInParentheses(text) {
            return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g, ' ')
        }
    }

    function breakContentIntoSentences(content) {
        content.sentences = []

        const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
        sentences.forEach(sentence => {
            content.sentences.push({
                text: sentence,
                keywords: [],
                images: []
            })
        })
    }

    function limitMaximumSentences(content) {
        content.sentences = content.sentences.slice(0, content.maximumSentences)
    }

    async function fetchWatsonAndReturnKeywords(sentence) {
        return new Promise((resolve, reject) => {
            try {
                const nlu = new NaturalLanguageUnderstandingV1({
                    authenticator: new IamAuthenticator({
                        apikey: process.env.NATURAL_LANGUAGE_UNDERSTANDING_IAM_APIKEY
                    }),
                    version: '2018-04-05',
                    serviceUrl: process.env.NATURAL_LANGUAGE_UNDERSTANDING_URL
                })

                nlu.analyze({
                    text: sentence,
                    features: {
                        keywords: {}
                    }
                }).then(response => {
                    const keywords = response.result.keywords.map(keyword => keyword.text)
                    resolve(keywords)
                }).catch(error => reject(error))
            } catch (error) {
                if (error.toString().indexOf('Insufficient credentials') === -1) {
                    console.log(error)
                    reject(error)
                } else {
                    resolve(sentence.split(' '))
                }
            }
        })
    }

    async function fetchKeywordOfAllSentences(content) {
        for (const sentence of content.sentences) {
            sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text)
        }
    }
}

module.exports = robot