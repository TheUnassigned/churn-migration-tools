/**
 * Given a channel if from previous churn (and api endpoint),
 * this will bring across n videos into the given new channel slug
 */
import _ from 'lodash'
import minimist from 'minimist'
import fetch from 'node-fetch'
import initClient from 'graphql-client'

// return an in order array of video ids from an old version channel
const getVideoIds = (api, channelId, maxVideos) => {
  // start by getting the channel information to get the starting video
  return fetch(`${api}/channel/${channelId}`)
    .then(res => res.json())
    .then(channel => {
      console.log(channel)
      return channel.defaultVideoId
    })
    .then(startId => {
      fetch(`${api}/channel/${channelId}/video/${startId}/above`)
        .then(res => res.json())
        .then(videos => {
          console.log(videos)
          return videos
        })
    })
}

// add a video id to a new channel
const addVideo = (client, channelSlug, videoId) => {
  console.log('adding video:', videoId)
  const variables = {
    channel_slug: channelSlug,
    video_url: `http://www.youtube.com/watch?v=${videoId}`
  }

  return client.query(`
    mutation addVideo($channel_slug: String, $video_url: String) {
      addVideo(channel_slug: $channel_slug, video_url: $video_url) {
        youtube_id
      }
    }
  `, variables)
}

// add a set of video ids to a new channel
const addVideos = (client, channelSlug, videoIds) => {
  console.log('--- Adding video set to:', channelSlug, '---')
  return videoIs.reduce((p, videoId) =>
    p.then(addVideo(client, channelSlug, videoId)), Promise.resolve())
}

// get the args and make sure they are correct
const args = minimist(process.argv.slice(2))

if(!_.has(args, ['oldapi', 'oldid', 'api', 'slug', 'token'])){
  console.log(`Usage: channel_import
    -oldapi <old churn api server address>
    -oldid <old channel id>
    -api <new churn api address>
    -slug <new channel slug>
    -token <new channel auth token>
    [-max <optional maximum number of recent videos to bring across]`
  )
}

const { oldapi, oldid, api, token, slug, max } = args

const gqlClient = initClient({
  url: api,
  headers: {
    Authorization: 'Bearer ' + token
  }
})

// run the process, adding one by one using a promise chain
getVideoIds(oldapi, oldid, max)
  .then(videoIds => addVideos(gqlClient, slug, videoIds)
  .then(() => {
    console.log('completed video import')
  })
  .catch(err => {
    console.err(err)
  })
