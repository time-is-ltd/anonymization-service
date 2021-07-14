import { bootstrap } from '../bootstrap'
import {
  getUserMessageSchema,
  listCalendarEventsSchema,
  listUserCalendarsSchema,
  listUserMessagesSchema
} from './googleapis-schemas'
import { containsNothingButDomains, overrideEnvs, validateUsingSchema } from './test-utils'
import * as request from 'supertest'

const gsuite_test_user = process.env.GSUITE_TEST_USER
const api_token = process.env.API_TOKEN
const env = Object.assign({}, process.env)

let app
let server

const CONFIG_DEFAULT = {}
const CONFIG_EXTRACT_DOMAINS = {
  'EXTRACT_DOMAINS': true
}

afterEach(() => {
  // reset envs back to their original state
  process.env = env
})

beforeAll(async () => {
  app = await bootstrap()
  server = app.listen(30003)
})

afterAll(async () => {
  server.close()
})

test('healthcheck returns 200/OK', async () => {
  await request(app).get('/healthcheck').expect(200)
    .then((response) => {
      expect(response.text).toBe('OK')
    })
})

test('withstands stress load', async () => {
  const requests = []
  for (let i = 0; i < 1000; i++) {
    requests.push(request(app).get('/healthcheck')
      .expect(200)
      .then((response) => {
        expect(response.text).toBe('OK')
      }))
  }
  await Promise.all(requests)
})

test('unknown endpoint returns 404', async () => {
  await request(app).get('/foobar')
    .expect(404)
})

test('no bearer returns 403', async () => {
  await request(app).get(`/www.googleapis.com/calendar/v3/users/${gsuite_test_user}/calendars/${gsuite_test_user}/events`)
    .expect(403)
})

test('invalid bearer returns 403', async () => {
  await request(app).get(`/www.googleapis.com/calendar/v3/users/${gsuite_test_user}/calendars/${gsuite_test_user}/events`)
    .set('Authorization', 'Bearer foobar')
    .expect(403)
})

test.each([CONFIG_DEFAULT, CONFIG_EXTRACT_DOMAINS])('can list gsuite emails', async (config) => {
  overrideEnvs(config)
  await request(app).get(`/www.googleapis.com/gmail/v1/users/${gsuite_test_user}/messages`)
    .set('Authorization', `Bearer ${api_token}`)
    .expect(200)
    .then((response) => {
      validateUsingSchema(response.body, listUserMessagesSchema)
    })
})

test.each([CONFIG_DEFAULT, CONFIG_EXTRACT_DOMAINS])('can get individual gsuite email', async (config) => {
  overrideEnvs(config)
  await request(app).get(`/www.googleapis.com/gmail/v1/users/${gsuite_test_user}/messages/17a0f96a2ab5ab11`)
    .set('Authorization', `Bearer ${api_token}`)
    .expect(200)
    .then((response) => {
      validateUsingSchema(response.body, getUserMessageSchema)
    })
})

test.each([CONFIG_DEFAULT, CONFIG_EXTRACT_DOMAINS])('can list gsuite calendars', async (config) => {
  overrideEnvs(config)
  await request(app).get(`/www.googleapis.com/calendar/v3/users/${gsuite_test_user}/calendarList`)
    .set('Authorization', `Bearer ${api_token}`)
    .then((response) => {
      validateUsingSchema(response.body, listUserCalendarsSchema)
    })
})

test.each([CONFIG_DEFAULT, CONFIG_EXTRACT_DOMAINS])('can list gsuite calendar events', async (config) => {
  overrideEnvs(config)
  await request(app).get(`/www.googleapis.com/calendar/v3/users/${gsuite_test_user}/calendars/${gsuite_test_user}/events`)
    .set('Authorization', `Bearer ${api_token}`)
    .then((response) => {
      validateUsingSchema(response.body, listCalendarEventsSchema)
      Object.values(response.body.items).forEach(event => {
        containsNothingButDomains(event['summary'])
        containsNothingButDomains(event['description'])
      })
    })
})

//
// Helpers
//






