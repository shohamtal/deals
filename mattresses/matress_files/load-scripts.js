// var initialConfigScript = document.createElement('script');
        // document.body.appendChild(initialConfigScript);

        // initialConfigScript.onload = function () {

        var bundleScriptPath = '/bundles/widget.js';
        var scriptPath = '/dist/widget.entry.min.js';


        // load new widget if needed
        var temp_enableNewWidgetDesign = window.location.search.indexOf('temp_enableNewWidgetDesign=true') > -1;

        if (temp_enableNewWidgetDesign) {
            scriptPath = '/dist/widget_new.entry.min.js';
        }


    var firstScript = document.createElement('script');
    document.body.appendChild(firstScript);

    function loadSecondScript() {
        var secondScript = document.createElement('script');
        document.body.appendChild(secondScript);
        secondScript.onerror = function () {
            // this should be loaded last
            
            var secondFallbackScript = document.createElement('script');
            document.body.appendChild(secondFallbackScript);
            secondFallbackScript.src = appHost + scriptPath + '?v=' + window.resourcesVersion;
        }
        secondScript.src = cdnHost + scriptPath + '?v=' + window.resourcesVersion;
    }

    firstScript.onload = function () {
        // this should be loaded last

        loadSecondScript();
    }

    firstScript.onerror = function() {
        var fallbackScript = document.createElement('script');
        document.body.appendChild(fallbackScript);
        
        fallbackScript.onload = function () {
            // this should be loaded last
            
            loadSecondScript();
        }

        fallbackScript.src =  appHost + bundleScriptPath + '?v=' + window.resourcesVersion;
    }

    firstScript.src = cdnHost + bundleScriptPath + '?v=' + window.resourcesVersion;
    // }

    // var initialConfigSource;

    // if (window.location.host.indexOf('dev') > -1) {
    //     initialConfigSource = 'https://glassix-functions-dev-west-eu-1.azurewebsites.net/api/widget/initialconfig';
    // } else {
    //     initialConfigSource = 'https://functions.glassix.com/api/widget/initialconfig';
    // }

    // initialConfigScript.src = initialConfigSource + '?d=' + new Date().getTime();