export const getId = () =>
  'FRAMECOMMS_' +
  String((Math.random() * 100000 + 10000).toFixed(5).split('.').join('_'))
