function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error('Validation error for socket event', { errors: result.error });
    return false;
  }
  return result.data;
}

module.exports = { validate };