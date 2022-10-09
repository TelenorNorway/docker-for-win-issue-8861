import { check } from 'k6'
import http from 'k6/http'
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

const minuteStages = new SharedArray('minuteStages', function () {
    return [
                        261,
                        176,
                        236,
                        211,
                        226,
                        164,
                        192,
                        173,
                        196,
                        180,
                        204,
                        180,
                        340,
                        215,
                        200,
                        202,
                        163,
                        215,
                        262,
                        362,
                        237,
                        223,
                        276,
                        214,
                        231,
                        307,
                        221,
                        268,
                        405,
                        284];
});

let scenariosDynamic = {};
let multiplier = parseInt(__ENV.MULTIPLIER);

if(__ENV.CASE === "1"){
    //Scenario 1 - scenario pr. min
    let stageStartTime = 0;

    minuteStages.forEach((callPerMin) => {
        scenariosDynamic["minute-" + stageStartTime] = {
            executor: 'constant-arrival-rate',
            startTime: stageStartTime+'m',
            duration: '1m',
            rate: callPerMin * multiplier,
            timeUnit: '1m',
            preAllocatedVUs: callPerMin * multiplier,
            maxVUs: (callPerMin * multiplier)*4, //leave some headroom
        };
        stageStartTime++;
    });
}else if(__ENV.CASE === "2"){
    //scenario 2: ramping stage pr. min
    let rampingStages = [];

    minuteStages.forEach((callPerMin) => {
        rampingStages.push({
            target: callPerMin*multiplier,
            duration: '1m',
        });
    });

    scenariosDynamic = {
        variableRate2: {
            executor: 'ramping-arrival-rate',
            startRate: 0,
            timeUnit: '1m',
            preAllocatedVUs: arrayMax(minuteStages) * multiplier,
            maxVUs: (arrayMax(minuteStages) * multiplier) * 4,
            stages: rampingStages,
        }
    };
}else if(__ENV.CASE === "3"){
    scenariosDynamic = {
        fixedRate: {
            executor: 'constant-vus',
            vus: multiplier,
            duration: '30m',
            gracefulStop: '0s',
        }
    };
}else if(__ENV.CASE === "4"){
    scenariosDynamic = {
        fixedIterations: {
            executor: 'shared-iterations',
            vus: multiplier,
            iterations: 7024,
            maxDuration: '30m',
            gracefulStop: '0s',
        }
    };
}else{
    exec.test.abort('Env variable CASE not set to a valid value [1, 2], got ['+__ENV.CASE+']');
}

export const options = {
    insecureSkipTLSVerify: true,
    scenarios: scenariosDynamic,
}

//Log our config
let hostname = __ENV.TARGET_HOST;

export function setup() {
    console.log("Test configured as case ["+__ENV.CASE+"] @ ["+multiplier+"]x -> ["+hostname+"]");
}

export default function() {

    const response = http.get(hostname);

    check(response, {
        'Free from \'dial: i/o\'-timeouts': (r) => !('error' in r && r.error.toLowerCase().indexOf('dial: i/o timeout') !== -1),
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