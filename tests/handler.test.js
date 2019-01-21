import fs from 'fs';
import nock from 'nock';
import * as handler from '../handler';

const AWS = require('aws-sdk-mock');

const event = 'event';
const context = 'context';

beforeEach(() => {
  // nock out the tft pages
  nock('https://www.newyorker.com')
    .get('/magazine/tables-for-two')
    .reply(200, fs.readFileSync(
      'tests/fakes/magazine__tables-for-two.htm',
    ))
    .get('/magazine/2019/01/28/uptown-glamour-and-tortellini-pie-at-leonti')
    .reply(200, fs.readFileSync(
      'tests/fakes/magazine__2018__12__24__a-chefs-mini-empire-in-the-evelyn-hotel.htm',
    ));

  // nock out google maps
  nock('https://maps.googleapis.com')
    .get('/maps/api/place/findplacefromtext/json')
    .query(() => true) // dont match exact query string
    .reply(
      200,
      fs.readFileSync('tests/fakes/google_places_search.json'),
      { 'Content-Type': 'application/json' },
    )
    .get('/maps/api/place/details/json')
    .query(() => true)
    .reply(
      200,
      fs.readFileSync('tests/fakes/google_places_details.json'),
      { 'Content-Type': 'application/json' },
    );

  // mock sns
  AWS.mock('SNS', 'publish', 'test-message');
});

afterEach(() => {
  nock.cleanAll();
  AWS.restore();
});

it('should work', async () => {
  const callback = (err, body) => {
    expect(err).toBe(null);
    expect(body.success).toEqual(true);
  };
  const response = await handler.handle(event, context, callback);
  expect(response.success).toBe(true);
});
