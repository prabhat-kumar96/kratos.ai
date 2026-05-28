class ApiError extends Error {
    constructor(                                  //A special function that runs automatically when a new object is created from this class
        statusCode,
        message= "Something went wrong",
        errors = [],
        stack = ""
    ){
        super(message)                         //Calls the Error class constructor,  Initializes the error message properly
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false;
        this.errors = errors

        if (stack) {
            this.stack = stack
        } else{
            Error.captureStackTrace(this, this.constructor)
        }

    }
}

export {ApiError}