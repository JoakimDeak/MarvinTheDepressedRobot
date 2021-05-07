const { Autohook } = require('twitter-autohook');
const util = require('util');
const request = require('request');
const url = require('url');
const http = require('http');
const dotenv = require('dotenv');
const fetch = require('node-fetch')

dotenv.config();

const post = util.promisify(request.post);

const oAuthConfig = {
    token: process.env.TWITTER_ACCESS_TOKEN,
    token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
};

(async start => {
    try {
        const webhook = new Autohook();

        webhook.on('event', async event => {
            if (event.direct_message_events) {
                const message = event.direct_message_events.shift();

                if (typeof message === 'undefined' || typeof message.message_create === 'undefined') {
                    return;
                }

                if (message.message_create.sender_id === message.message_create.target.recipient_id) {
                    return;
                }
                let tweetId = getTweetId(message);
                let urlList = await getVideoUrls(tweetId);
                let bestUrl = getBestUrl(urlList);

                const requestConfig = {
                    url: 'https://api.twitter.com/1.1/direct_messages/events/new.json',
                    oauth: oAuthConfig,
                    json: {
                        event: {
                            type: 'message_create',
                            message_create: {
                                target: {
                                    recipient_id: message.message_create.sender_id,
                                },
                                message_data: {
                                    text: `${bestUrl}`,
                                },
                            },
                        },
                    },
                };
                await post(requestConfig);
            }
        });

        // Removes existing webhooks
        await webhook.removeWebhooks();

        // Starts a server and adds a new webhook
        await webhook.start();

        // Subscribes to your own user's activity
        await webhook.subscribe({ oauth_token: "1324874116571275265-5849bpY0VTTNa6QLhjTTGQt5y5EDy4", oauth_token_secret: "GVavC4FRVtwSkuFDTUheFO26fvQ8r0rsxEYMm0KatKZWU" });
    } catch (e) {
        // Display the error and quit
        console.error(e);
        process.exit(1);
    }
})();

function getTweetId(message) {
    let tweetUrl = message.message_create.message_data.entities.urls[0].expanded_url;
    let a = tweetUrl.lastIndexOf('/');
    let tweetId = tweetUrl.substring(a + 1);
    return tweetId;
}

const getVideoUrls = async (tweetId) => {

    const result = await fetch(`https://api.twitter.com/1.1/statuses/show.json?id=${tweetId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
    })

    const data = await result.json()
    return data.extended_entities.media[0].video_info.variants;
}

function getBestUrl(urlList) {
    let bestIndex = -1;
    let bestBitrate = -1;
    for (let i = 0; i < urlList.length; i++) {
        if (urlList[i].content_type != 'application/x-mpegURL') {
            if (urlList[i].bitrate > bestBitrate) {
                bestBitrate = urlList[i].bitrate;
                bestIndex = i;
            }
        }
    }
    return urlList[bestIndex].url;
}
