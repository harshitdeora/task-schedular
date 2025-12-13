/**
 * Standardized response utility for API endpoints
 */
export const sendResponse = (res, statusCode, data) => {
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    ...data
  });
};


