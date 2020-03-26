import {
  jsonMapper,
  TYPES,
  Schema
} from '../../../helpers/mapper.helper'
import { Event } from '../common/interfaces'
import { event } from '../common/schema'

export type UserEvents = {
  '@odata.context': string,
  '@odata.nextLink': string,
  value: Event[]
}

const schema: Schema<UserEvents> = {
  '@odata.context': TYPES.String,
  '@odata.nextLink': TYPES.Url,
  'value': [
    event
  ]
}

export default jsonMapper<typeof schema, UserEvents>(schema)
