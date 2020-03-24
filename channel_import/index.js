/**
 * Given a channel if from previous churn (and api endpoint),
 * this will bring across n videos into the given new channel slug
 */
/*import _ from 'lodash'
import minimist from 'minimist'
import fetch from 'node-fetch'
import initClient from 'graphql-client'*/

var _ = require('lodash')
var minimist = require('minimist')
var fetch = require('node-fetch')
var initClient = require('graphql-client')

var getAbove = function(api, channelId, list){
  return fetch(`${api}/channel/${channelId}/video/${list[0].pointerId}/above`)
  .then(function(res){ return res.json() })
  .then(function(res){ return res.data })
  .then(function(videos){
    console.log('gotpage')
    //console.log(videos)
    if(videos.length > 0){
      var combined = videos.concat(list)
      return getAbove(api, channelId, combined)
    }else{
      return list
    }
  })
}

// return an in order array of video ids from an old version channel
var getVideoIds = function(api, channelId, maxVideos){
  // start by getting the channel information to get the starting video
  return fetch(`${api}/channel/${channelId}`)
    .then(function(res){ return res.json() })
    .then(function(channel){
      console.log(channel)
      return channel.data.defaultVideoId
    })
    .then(function(startId){
      return fetch(`${api}/channel/${channelId}/video/${startId}/middle`)
        .then(function(res){ return res.json() })
        .then(function(videos){
          //console.log(videos)
          console.log('got middle page')
          return videos.data
        })
    })
    .then(function(listBottom){
      // keep working up list, and adding to the start if videos are available or max is reached
      return getAbove(api, channelId, listBottom)
        .then(function(songs){
          console.log(songs.length)
          return songs.concat(listBottom)
        })
    })
}

// add a video id to a new channel
var addVideo = function(client, channelSlug, videoId){
  console.log('adding video:', videoId)
  const variables = {
    channel_slug: channelSlug,
    video_url: `http://www.youtube.com/watch?v=${videoId}`
  }

  return client.query(`
    mutation addVideo($channel_slug: String!, $video_url: String!) {
      addVideo(channel_slug: $channel_slug, video_url: $video_url) {
        youtube_id
      }
    }
  `, variables)
}

// add a set of video ids to a new channel
var addVideos = function(client, channelSlug, videoIds){
  console.log('--- Adding video set to:', channelSlug, '---')
  console.log(videoIds.length)
  //console.log(videoIds)
  var done = Promise.resolve()
  videoIds.forEach(function(id){
    done = done.then(function(){
      var curId = id
      console.log(curId)
      return addVideo(client, channelSlug, curId)
        .then(function(resp){
          console.log(resp)
        })
        .catch(function(err){
          console.log('got single add error ----')
          console.log(err)
        })
    })
  })
  return done
}

// get the args and make sure they are correct
var args = minimist(process.argv.slice(2), { string: true })

if(!_.has(args, ['oldapi', 'oldid', 'api', 'slug', 'token'])){
  console.log(`Usage: channel_import
    --oldapi <old churn api server address>
    --oldid <old channel id>
    --api <new churn api address>
    --slug <new channel slug>
    --token <new channel auth token>
    [--max <optional maximum number of recent videos to bring across]`
  )
}

//const { oldapi, oldid, api, token, slug, max } = args
var oldapi = args.oldapi
var oldid = args.oldid
var api = args.api
var token = args.token
var slug = args.slug
var max = args.max

console.log('aaaapppiii')
console.log(args)

var gqlClient = initClient({
  url: api,
  headers: {
    Authorization: 'Bearer ' + token
  }
})

// run the process, adding one by one using a promise chain
getVideoIds(oldapi, oldid, max)
  .then(function(videos){ return videos.map(function(v){ return v.youtubeId })})
  .then(function(videoIds){ return addVideos(gqlClient, slug, videoIds) })
  .then(function() {
    console.log('completed video import')
  })
  .catch(function(err){
    console.error(err)
  })
