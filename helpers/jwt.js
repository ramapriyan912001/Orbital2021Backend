const expressjwt = require('express-jwt');

function authJwt() {
    const api = process.env.API_URL;
    const secret = process.env.tokenSecret;
    return expressjwt({
        secret,
        algorithms: ['HS256'],
        isRevoked: isRevoked,
    })
    .unless({
        path: [
            // {//Create an Object to add multiple methods to a generic link -> KEEPING THIS if we need to use something similar later
            //     url: /\/public\/uploads(.*)/,// Use RegEx to cover all possible links 
            //     methods: ['GET', 'OPTIONS']// We shuold be able to get any product without authentication (Post requires authentication)
            // },
            //Standard way to exclude REST APIs from authentication by manually adding the whole link
            `${api}/users/login`,
            `${api}/users/register`
        ]
    })
}

async function isRevoked (req, payload, done) {//Request, Payload carried by jwt, done status
    if (!payload.isAdmin) {//Then we reject all authenticated API calls
        done(null, true);
    }
    done();
}

module.exports = authJwt;