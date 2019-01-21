import fetch from 'node-fetch';
import querystring from 'querystring';
import { get as getOrDefault, sortedUniq } from 'lodash';

const AWS = require('aws-sdk');


const log = (json) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(json));
};

const googleApiKey = process.env.GOOGLE_API_KEY || '';
const googHost = 'maps.googleapis.com';
const googPlacesSearchUrl = '/maps/api/place/findplacefromtext/json';
const googPlacesDetailsUrl = '/maps/api/place/details/json';

const tftHost = 'www.newyorker.com';
const tftUrl = '/magazine/tables-for-two';
const tftArticlesRegex = /\/magazine\/\d{4}\/\d{2}\/\d{2}\/[a-zA-Z0-9-]+/ig;
const tftRestaurantNameRegex = /"alternativeHeadline"\s*:\s*"([^"]*)"/;

const snsArn = process.env.AWS_SNS_ARN || '';

const getRestaurantsUrl = async () => {
  const response = await fetch(`https://${tftHost}${tftUrl}`);
  const indexPage = await response.text();
  const matches = sortedUniq(indexPage.match(tftArticlesRegex));
  return matches || [];
};

const getRestaurantName = async (restaurantUrl) => {
  const response = await fetch(`https://${tftHost}${restaurantUrl}`);
  const restaurantPage = await response.text();
  const matches = restaurantPage.match(tftRestaurantNameRegex);
  return matches === null ? null : matches[1];
};

const getGooglePlaceId = async (name) => {
  const query = querystring.stringify({
    input: `${name} restaurant`,
    inputtype: 'textquery',
    locationbias: 'circle:50000@40.724313,-73.999531', // new york
    key: googleApiKey,
  });
  const response = await fetch(`https://${googHost}${googPlacesSearchUrl}?${query}`);
  const json = await response.json();
  return getOrDefault(json, 'candidates[0].place_id', null);
};

const snsRequest = (placeDetails) => {
  const message = `Restaurant Recommendation from the New Yorker

Name: ${placeDetails.name}
Address: ${placeDetails.formatted_address}
Price Level: ${placeDetails.price_level}
Rating: ${placeDetails.rating}
Map: ${placeDetails.maps_url}
New Yorker Url: ${placeDetails.new_yorker_url}
Website: ${placeDetails.website || ''}`;
  return {
    TopicArn: snsArn,
    Subject: 'Restaurant Recommendation',
    Message: message,
  };
};

const getGooglePlaceDetails = async (placeId) => {
  const query = querystring.stringify({
    place_id: placeId,
    fields: 'name,place_id,formatted_address,price_level,rating,url,website',
    key: googleApiKey,
  });
  const response = await fetch(`https://${googHost}${googPlacesDetailsUrl}?${query}`);
  const json = await response.json();
  return getOrDefault(json, 'result', null);
};

// eslint-disable-next-line import/prefer-default-export
export const handle = async (event, context, callback) => {
  // init AWS
  AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
  const sns = new AWS.SNS();

  // grab restaurants from the tft index page
  let restaurantUrls;
  try {
    restaurantUrls = await getRestaurantsUrl();
    if (restaurantUrls.length === 0) {
      throw new Error('no restaurants found');
    }
  } catch (err) {
    log({ message: 'cannot parse restaurant urls' });
    callback(err, { success: false });
    return { success: false };
  }

  // grab restaurant name from url
  const restaurantUrl = restaurantUrls[0];
  let restaurantName;
  try {
    restaurantName = await getRestaurantName(restaurantUrl);
    if (!restaurantName) {
      throw new Error('no restaurant name found');
    }
  } catch (err) {
    log({ message: `cannot parse restaurant name "${restaurantName}"` });
    callback(err, { success: false });
    return { success: false };
  }

  // get google place id
  let placeId;
  try {
    placeId = await getGooglePlaceId(restaurantName);
    if (!placeId) {
      throw new Error('cannot find place on google');
    }
  } catch (err) {
    log({ message: `cannot find place "${restaurantName}" on google` });
    callback(err, { success: false });
    return { success: false };
  }

  // get more details from google
  let placeDetails;
  try {
    placeDetails = await getGooglePlaceDetails(placeId);
    if (!placeDetails) {
      throw new Error('cannot find restaurant details on google');
    }
  } catch (err) {
    log({ message: `cannot find details for place "${placeId}" on google` });
    callback(err, { success: false });
    return { success: false };
  }

  // rename some keys
  placeDetails.new_yorker_url = `https://${tftHost}${restaurantUrl}`;
  placeDetails.maps_url = placeDetails.url;
  delete placeDetails.url;

  // send notification
  try {
    await sns
      .publish(snsRequest(placeDetails))
      .promise();
  } catch (err) {
    log({ message: 'cannot send sns notification' });
    callback(err, { success: false });
    return { success: false };
  }

  log({ message: `found a place! ${JSON.stringify(placeDetails)}` });
  callback(null, { success: true });
  return { success: true };
};
