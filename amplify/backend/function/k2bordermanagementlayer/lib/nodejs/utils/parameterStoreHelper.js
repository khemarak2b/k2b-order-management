const { SSMClient, GetParametersCommand } = require("@aws-sdk/client-ssm");

const ssmClient = new SSMClient();
const cache = new Map();
const CACHE_TTL = 3600; // Default TTL in seconds (1 hour)
let lastUpdate = 0;

/**
 * This function is used to get parameter value by its key that is stored in aws parameter store.
 * @param { array } parameterKeys of the parameter that is stored in aws parameter store.
 * @param { boolean } withDecryption this should set to true if parameter is encrypted at aws parameter store
 * @returns { Promise } parameter value
 */
async function getParameterStoreValueByKey(parameterKeys, withDecryption) {
  const methodName = "getParameterStoreValueByKey";

  console.log(methodName, "Getting Parameters from parameter store", {
    parameterKeys: parameterKeys,
    withDecryption: withDecryption,
  });

  try {
    const currentTime = Math.floor(Date.now() / 1000);

    // Check if all requested keys exist in cache and cache is not expired
    const allKeysInCache = parameterKeys.every((key) => cache.has(key));
    const cacheExpired = currentTime - lastUpdate > CACHE_TTL;

    if (!allKeysInCache || cacheExpired) {
      console.log(methodName, "Cache miss or expired, fetching from parameter store", {
        allKeysInCache,
        cacheExpired,
        CACHE_TTL: CACHE_TTL,
      });

      cache.clear();

      try {
        const command = new GetParametersCommand({
          Names: parameterKeys,
          WithDecryption: withDecryption,
        });

        const response = await ssmClient.send(command);

        response.Parameters?.forEach((param) => {
          cache.set(param.Name, {
            Value: param.Value,
          });
        });

        lastUpdate = currentTime;
      } catch (error) {
        console.error(methodName, "Failed to fetch parameters", error);
        throw error;
      }
    }

    // Return only the requested keys
    const result = new Map();
    parameterKeys.forEach((key) => {
      if (cache.has(key)) {
        result.set(key, cache.get(key));
      }
    });

    return result;
  } catch (err) {
    console.error(methodName, "ERROR WHILE READING PARAMETERS", err);
    throw err;
  }
}

module.exports = { getParameterStoreValueByKey };
