// Production fallback
window.resourcesVersion = '1.0.0.0';
window.appHost = 'https://app.glassix.com';
window.cdnHost = 'https://cdn.glassix.com';
window.serverDateTimeDifferenceInSeconds = 0;
window.instrumentationKey = '12624fbc-f331-4e59-a203-84694cb48c1c';
window.environment = 'prod';


if (window.location && (window.location.host === 'static-dev.glassix.com' || window.location.host.indexOf('localhost') > -1)) {
    window.appHost = 'https://app.glassix-dev.com';
    window.cdnHost = 'https://cdn-dev.glassix.com';
    window.instrumentationKey = 'aaf185d7-2579-426b-948d-9987829e04b2';
    window.environment = 'test';
    
    console.log('Development environment');
}