import { IncomingMessage, ServerResponse } from 'http'
import { decryptUrlMiddleware, mapBodyMiddleware, modifyHeadersMiddleware, transformUrlMiddleware } from './middlewares'
import { AuthorizationFactory, DataMapper, BodyMapper } from './interfaces'
import { receiveBody } from './helpers'
import { sendResponseFactory } from './helpers/send-response-factory.helper'
import { request as makeRequest, RequestError, RequestOptions } from '../request'
import config from '../app.config'
import prettify from '../helpers/prettify'

interface ProxyParams {
  authorizationFactory: AuthorizationFactory
  dataMapper: DataMapper
  bodyMapper?: BodyMapper
  urlTransform?: (url: string) => string,
  allowedHeaders?: string[]
}

const logRequest = async (url, statusCode, statusMessage, originalBody, responseData, modifiedData) => {
  if (await config.verbosity < 2) {
    return
  }

  let report = "\n===== Data log start =====\n"
  report += `Request '${url} ${statusCode} ${statusMessage}'`
  if (originalBody) {
    report += "\nRequest body:\n"
    report += originalBody
  }
  report += "\nResponse body:\n"
  report += prettify(responseData)
  report += "\nModified body:\n"
  report += prettify(modifiedData)
  report += "\n===== Data log end =====\n"

  console.log(report)
}

export const proxyFactory = (params: ProxyParams) => async (req: IncomingMessage, res: ServerResponse, _) => {
  const {
    authorizationFactory,
    dataMapper,
    bodyMapper,
    urlTransform = url => url,
    allowedHeaders
  } = params

  const sendResponse = sendResponseFactory(res)
  Promise
    .resolve(req)
    .then(receiveBody())
    .then(mapBodyMiddleware(authorizationFactory, bodyMapper))
    .then(decryptUrlMiddleware())
    .then(modifyHeadersMiddleware(authorizationFactory))
    .then(transformUrlMiddleware(urlTransform))
    .then(async request => {
      const { method, headers, body, originalRequest, url } = request
      const options: RequestOptions = {
        method,
        headers,
        data: body?.length > 0 ? body : undefined
      }

      const response = await makeRequest(url, options)
      const originalBody = originalRequest.body
      return {
        url,
        originalBody,
        response
      }
    })
    .then(async ({ url, originalBody, response }) => {
      const { headers, statusCode, statusMessage } = response
      const data = await dataMapper(response.data, originalBody)
      await logRequest(url, statusCode, statusMessage, originalBody, response.data, data)

      sendResponse({
        headers,
        statusCode,
        statusMessage,
        data,
        allowedHeaders
      })
    })
    .catch(err => {
      if (err instanceof RequestError) {
        const { statusCode, statusMessage } = err
        return sendResponse({
          statusCode,
          statusMessage
        })
      }

      // Unknown error
      sendResponse({
        statusCode: 500,
        statusMessage: 'Unknown error'
      })
    })
}
