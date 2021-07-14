import Ajv from 'ajv'

const ajv = new Ajv()
const regexDomain = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/

export const containsNothingButDomains = (str: string) => {
  if (str == null) {
    return
  }

  for (let part in str.split(' ')) {
    if (!regexDomain.test(part))
      return false
  }
  return true
}

export const overrideEnvs = (envs: object) => {
  Object.keys(envs).forEach((key) => {
    process.env[key] = envs[key]
  })
}

export const validateUsingSchema = (obj: Object, schema: Object) => {
  const validate = ajv.compile(schema)
  const valid = validate(obj)
  if (!valid) {
    console.log(validate.errors)
  }
  expect(valid).toBeTruthy()
}