const fs = require('fs')
const express = require('express')
const opn = require('opn')
const google = require('googleapis').google
const youtube = google.youtube({
    version: 'v3'
})
const state = require('./state')

const OAuth2 = google.auth.OAuth2

const robot = async () => {
    const content = state.load()

    const authenticateWithOAuth = async () => {
        const startWebServer = async () => {
            return new Promise((resolve, reject) => {
                const port = 5000
                const app = express()

                const server = app.listen(port, () => {
                    console.log(`> Listening on http://localhost:${port}`)

                    resolve({
                        app,
                        server
                    })
                })
            })
        }

        const createOAuthClient = () => {
            const OAuthClient = new OAuth2(
                process.env.YOUTUBE_CLIENT_ID,
                process.env.YOUTUBE_SECRET_KEY,
                "http://localhost:5000/oauth"
            )

            return OAuthClient
        }

        const requestUserConsent = (OAuthClient) => {
            const consentUrl = OAuthClient.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/youtube']
            })

            opn(consentUrl)
        }

        const waitForGoogleCallback = async (webServer) => {
            return new Promise((resolve, reject) => {
                console.log(`> Please give your consent...`)

                webServer.app.get('/oauth', (req, res) => {
                    const authCode = req.query.code
                    res.send('<h1>Thank you!</h1><p>You can close this tab now.</p>')
                    resolve(authCode)
                })
            })
        }

        const requestGoogleForAccessTokens = async (OAuthClient, authorizationToken) => {
            return new Promise((resolve, reject) => {
                OAuthClient.getToken(authorizationToken, (error, tokens) => {
                    if (error) return reject(error)

                    OAuthClient.setCredentials(tokens)
                    resolve()
                })
            })
        }

        const setGlobalGoogleAuthentication = () => {
            google.options({
                auth: OAuthClient
            })
        }

        const stopWebServer = async (webServer) => {
            return new Promise((resolve, reject) => {
                webServer.server.close(() => resolve())
            })
        }

        const webServer = await startWebServer()
        const OAuthClient = createOAuthClient()
        requestUserConsent(OAuthClient)
        const authorizationToken = await waitForGoogleCallback(webServer)
        await requestGoogleForAccessTokens(OAuthClient, authorizationToken)
        setGlobalGoogleAuthentication()
        await stopWebServer(webServer)
    }

    const uploadVideo = async (content) => {
        const videoFilePath = './content/output.mp4'
        const videoFileSize = fs.statSync(videoFilePath).size
        const videoTitle = `${content.prefix} ${content.searchTerm}`
        const videoTags = [content.searchTerm, ...content.sentences[0].keywords]
        const videoDescription = content.sentences.map(sentence => (sentence.text)).join('\n\n')

        const requestParameters = {
            part: 'snippet, status',
            requestBody: {
                snippet: {
                    title: videoTitle,
                    description: videoDescription,
                    tags: videoTags
                },
                status: {
                    prvacyStatus: 'unlisted'
                }
            },
            media: {
                body: fs.createReadStream(videoFilePath)
            }
        }

        const onUploadProgress = (event) => {
            const progress = Math.round((event.bytesRead / videoFileSize) * 100)
            console.log(`> ${progress}% completed`)
        }

        const youtubeResponse = await youtube.videos.insert(requestParameters, {
            onUploadProgress: onUploadProgress
        })

        console.log(`> Video available at: https://youtu.be/${youtubeResponse.data.id}`)
        return youtubeResponse.data
    }

    const uploadThumbnail = async (videoInformation) => {
        const videoId = videoInformation.id
        const videoThumbnailFilePath = './content/youtube-thumbnail.jpg'

        const requestParameters = {
            videoId: videoId,
            media: {
                mimetype: 'image/jpeg',
                body: fs.createReadStream(videoThumbnailFilePath)
            }
        }

        const youtubeResponse = await youtube.thumbnails.set(requestParameters)
        console.log(`> Thumbnail uploaded!`)
    }

    await authenticateWithOAuth()
    const videoInformation = await uploadVideo(content)
    await uploadThumbnail(videoInformation)
}

module.exports = robot