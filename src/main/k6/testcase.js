import { check } from 'k6'
import http from 'k6/http'
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

let multiplier = parseInt(__ENV.VU_COUNT);
let iters = parseInt(__ENV.ITERS);

let scenariosDynamic = {
    fixedIterations: {
        executor: 'shared-iterations',
        vus: multiplier,
        iterations: iters*multiplier,
        maxDuration: '30m',
        gracefulStop: '0s',
    }
};

export const options = {
    insecureSkipTLSVerify: true,
    scenarios: scenariosDynamic,
}

//Log our config
let hostname = __ENV.TARGET_HOST;

export function setup() {
    console.log("Test configured as ["+iters+"x"+multiplier+"] -> ["+hostname+"]");
}

export default function() {

    const response = http.get(hostname);

    if(response.error_code !== undefined && !(response.error_code === 0 || response.error_code === 1211 || response.error_code === 1212)){
        console.log('Error not individually tracked: '+response.error_code)
    }

    check(response, {
        'Free of \'dial: i/o-timeouts\'': (r) => r.error_code !== 1211,
        'Free of \'Connect: connection refused\'': (r) => r.error_code !== 1212,
        'Free from other errors': (r) => r.error_code === 0 || (r.error_code === 1211 || r.error_code === 1212),
        'Response from server': (r) => r.headers['Server'] === 'Apache/2.4.54 (Unix)',
        'HTTP/200 responses': (r) => r.status === 200,
        'Content as Expected': (r) => r.body === 'Hello from index.html!'
    });
}


//Util method from https://stackoverflow.com/a/13440842
function arrayMax(arr) {
    return arr.reduce(function (p, v) {
        return ( p > v ? p : v );
    });
}