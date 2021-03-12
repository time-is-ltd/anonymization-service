import { proxyFactory } from '../../proxy'
import { oauth2Request } from '../../oauth2/handlers/oauth2-token.handler'
import { Route } from '../../router/interfaces/router.interface'
import listUserMessagesMapper from './mappers/list-user-messages.mapper'
import listUserCalendarsMapper from './mappers/list-user-calendars.mapper'
import listUserEventsMapper from './mappers/list-user-events.mapper'

import tokenService from '../../token/token.service'

import config, {
  hosts,
  paths
} from './microsoftgraph.config'

const MICROSOFTGRAPH_TOKEN_ID = 'microsoftgraph'
const TOKEN_HOST = 'login.microsoftonline.com'

const refreshToken = async () => {
  const [tenantId, clientId, clientSecret] = await Promise.all([config.tenantId, config.clientId, config.clientSecret])

  const TOKEN_PATH = `/${tenantId}/oauth2/token`
  const TOKEN_URL = `https://${TOKEN_HOST}${TOKEN_PATH}`
  const oauth2Options = {
    url: TOKEN_URL,
    clientId,
    clientSecret,
    extra: {
      resource: 'https://graph.microsoft.com'
    }
  }

  const response = await oauth2Request(oauth2Options)
  const token = tokenService.update({
    id: MICROSOFTGRAPH_TOKEN_ID,
    ...response.data
  })

  return token
}

const authorizationFactory = async () => {
  let token = tokenService.getById(MICROSOFTGRAPH_TOKEN_ID)

  const isValid = !!token && tokenService.isValid(token)

  if (!isValid) {
    token = await refreshToken()
  }

  return `Bearer ${token.token}`
}

const listUserMessagesRoute: Route = {
  hosts,
  path: paths.listUserMessagesPath,
  handler: proxyFactory({
    authorizationFactory,
    dataMapper: listUserMessagesMapper
  })
}

const listUserCalendarsRoute: Route = {
  hosts,
  path: paths.listUserCalendarsPath,
  handler: proxyFactory({
    authorizationFactory,
    dataMapper: listUserCalendarsMapper
  })
}

const listUserEventsRoute: Route = {
  hosts,
  path: paths.listUserEventsPath,
  handler: proxyFactory({
    authorizationFactory,
    dataMapper: listUserEventsMapper
  })
}

const listCalendarEventsRoute: Route = {
  hosts,
  path: paths.listCalendarEventsPath,
  handler: proxyFactory({
    authorizationFactory,
    dataMapper: listUserEventsMapper
  })
}

const listCalendarViewRoute: Route = {
  hosts,
  path: paths.listCalendarViewPath,
  handler: proxyFactory({
    authorizationFactory,
    dataMapper: listUserEventsMapper
  })
}

export default async () => {
  const enabledPromiseAll = await Promise.all([config.tenantId, config.clientId, config.clientSecret])

  const enabled = enabledPromiseAll
    .reduce((result, item) => {
      return result && Boolean(item)
    }, true)

  return {
    enabled,
    routes: [
      listUserMessagesRoute,
      listUserCalendarsRoute,
      listUserEventsRoute,
      listCalendarEventsRoute,
      listCalendarViewRoute
    ]
  }
}
