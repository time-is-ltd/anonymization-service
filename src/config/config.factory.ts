import { Provider, ProviderResult, Response, TransformMap } from './types'
import { cacheFactory } from '../cache'
import { fromAzureKeyVault, fromCache, fromEnvVariable, fromGcpSecretManager } from './providers'
import { logger, VerboseLevel } from '../logger'

export const configFactory = <T extends TransformMap>(transformMap: T, vaultKeysAllowlist: Array<keyof T> = []) => {
  const cache = cacheFactory<T>()

  // Setup cache provider
  const cacheProvider = fromCache<T>(cache)

  // Setup ENV variable provider
  const envVariableProvider = fromEnvVariable<T>()

  // Setup GCP secret manager provider
  const gcpSecretManagerProjectId = process.env.GCP_SECRET_MANAGER_PROJECT_ID
  const gcpSecretManagerPrefix = process.env.GCP_SECRET_MANAGER_PREFIX
  const isGcpSecretManagerEnabled = Boolean(gcpSecretManagerProjectId)
  const gcpSecretManagerProvider = isGcpSecretManagerEnabled && fromGcpSecretManager<T>(gcpSecretManagerProjectId, gcpSecretManagerPrefix)

  // Setup Azure key vaul provider
  const azureKeyVaultName = process.env.AZURE_KEY_VAULT_NAME
  const isAzureKeyVaultEnabled = Boolean(azureKeyVaultName)
  const azureKeyVaultProvider = isAzureKeyVaultEnabled && fromAzureKeyVault<T>(azureKeyVaultName)
  const getFactory = <K extends keyof T> (key: K) => {
    const providers: Array<Provider<T, K>> = []
    if (!process.env.DISABLE_CONFIG_CACHE) {
      providers.push(cacheProvider)
    }
    providers.push(envVariableProvider)

    // GCP
    const isVaultKey = vaultKeysAllowlist.includes(key as string)
    if (isVaultKey) {
      if (gcpSecretManagerProvider) {
        providers.push(gcpSecretManagerProvider)
      }

      if (azureKeyVaultProvider) {
        providers.push(azureKeyVaultProvider)
      }
    }

    const composeProviders = (...fns: Array<Provider<T, K>>) => async (x: K): Promise<ProviderResult<string>> => {
      const isObject = (o: unknown): o is ProviderResult => {
        return o === Object(o)
      }
      for (const fn of fns) {
        const result = await fn(x)
        if (result != null) {
          if (isObject(result)) {
            return { ...result, v: String(result.v) }
          }
          return { v: String(result) }
        }
      }

      return { v: undefined }
    }

    const getValue = composeProviders(...providers)
    return async (): Promise<Response<T, K>> => {
      const functionOrObj = transformMap[key as string]
      const transformMapItem = typeof functionOrObj === 'function'
        ? { transform: functionOrObj }
        : functionOrObj

      const { transform } = transformMapItem

      if (!transform) {
        throw new Error('No transformer found')
      }

      const { defaultTtl = 0, v: value } = await getValue(key)

      const { ttl = defaultTtl } = transformMapItem
      const transformedValue = transform(value)

      if (transformedValue) {
        const secretStr = String(transformedValue).split('').map(v => `*`).join('')
        logger(VerboseLevel.V, `[Config]: Key ${key} loaded (value:${secretStr})`)
      }

      // Always set to prolong the ttl, if variable in use
      cache.set(key as string, transformedValue, ttl)

      return transformedValue
    }
  }

  return Object.keys(transformMap)
    .reduce((obj, key) => {
      const get = getFactory(key)
      Object.defineProperty(obj, key, { get })
      return obj
    }, {}) as {
    [K in keyof T]: Promise<Response<T, K>>
  }
}
