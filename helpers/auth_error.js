function auth_error (err, req, res, next) {
    if (err.name === 'UnauthorizedError') {//Catch Unauthorized Errors
        return res.status(401).json({
            message: 'The user is unauthorized!!',
            success: false
        });
    } else if (err.name === 'ValidationError') {//Catch Validation Errors
        return res.status(401).json({
            message: 'Invalid User',
            success: false
        });
    } else {
        return res.status(500).json({
            error: err,
            success: false
        });
    }
}

module.exports = auth_error;