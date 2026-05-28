const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }
}                  //ie as a function that takes another function as argument and returns a function
  

export { asyncHandler }