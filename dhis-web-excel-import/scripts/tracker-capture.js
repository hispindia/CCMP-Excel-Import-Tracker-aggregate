dhis2.util.namespace('dhis2.tc');

// whether current user has any organisation units
dhis2.tc.emptyOrganisationUnits = false;

// Instance of the StorageManager
dhis2.tc.storageManager = new StorageManager();

var TC_STORE_NAME = "dhis2";
var i18n_no_orgunits = 'No organisation unit attached to current user, no data entry possible';
var i18n_offline_notification = 'You are offline, data will be stored locally';
var i18n_online_notification = 'You are online';
var i18n_need_to_sync_notification = 'There is data stored locally, please upload to server';
var i18n_sync_now = 'Upload';
var i18n_sync_success = 'Upload to server was successful';
var i18n_sync_failed = 'Upload to server failed, please try again later';
var i18n_uploading_data_notification = 'Uploading locally stored data to the server';

var PROGRAMS_METADATA = 'TRACKER_PROGRAMS';

var TRACKER_VALUES = 'TRACKER_VALUES';

var optionSetsInPromise = [];

dhis2.tc.store = new dhis2.storage.Store({
    name: TC_STORE_NAME,
    adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
    objectStores: ['trackerCapturePrograms', 'programStages', 'trackedEntities', 'trackedEntityForms', 'attributes', 'relationshipTypes', 'optionSets']
});

(function($) {
    $.safeEach = function(arr, fn)
    {
        if (arr)
        {
            $.each(arr, fn);
        }
    };
})(jQuery);

/**
 * Page init. The order of events is:
 *
 * 1. Load ouwt 2. Load meta-data (and notify ouwt) 3. Check and potentially
 * download updated forms from server
 */
$(document).ready(function()
{
    $.ajaxSetup({
        type: 'POST',
        cache: false
    });

    $('#loaderSpan').show();

    $('#orgUnitTree').one('ouwtLoaded', function()
    {
        var def = $.Deferred();
        var promise = def.promise();
        
        promise = promise.then( dhis2.tc.store.open );
        promise = promise.then( getUserProfile );
        promise = promise.then( getCalendarSetting );
        promise = promise.then( getLoginDetails );
        promise = promise.then( getRelationships );
        promise = promise.then( getAttributes );
        promise = promise.then( getOptionSetsForAttributes );
        promise = promise.then( getTrackedEntities );
        promise = promise.then( getMetaPrograms );     
        promise = promise.then( getPrograms );     
        promise = promise.then( getProgramStages );    
        promise = promise.then( getOptionSetsForPrograms );
        promise = promise.then( getMetaTrackedEntityForms );
        promise = promise.then( getTrackedEntityForms );        
        promise.done(function() {
            selection.responseReceived();
        });

        def.resolve();

    });

    $(document).bind('dhis2.online', function(event, loggedIn)
    {
        if (loggedIn)
        {
            if (dhis2.tc.storageManager.hasLocalData())
            {
                var message = i18n_need_to_sync_notification
                        + ' <button id="sync_button" type="button">' + i18n_sync_now + '</button>';

                setHeaderMessage(message);

                $('#sync_button').bind('click', uploadLocalData);
            }
            else
            {
                if (dhis2.tc.emptyOrganisationUnits) {
                    setHeaderMessage(i18n_no_orgunits);
                }
                else {
                    setHeaderDelayMessage(i18n_online_notification);
                }
            }
        }
        else
        {
            var form = [
                '<form style="display:inline;">',
                '<label for="username">Username</label>',
                '<input name="username" id="username" type="text" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
                '<label for="password">Password</label>',
                '<input name="password" id="password" type="password" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
                '<button id="login_button" type="button">Login</button>',
                '</form>'
            ].join('');

            setHeaderMessage(form);
            ajax_login();
        }
    });

    $(document).bind('dhis2.offline', function()
    {
        if (dhis2.tc.emptyOrganisationUnits) {
            setHeaderMessage(i18n_no_orgunits);
        }
        else {
            setHeaderMessage(i18n_offline_notification);
            //selection.responseReceived(); //notify angular 
        }
    });

    //dhis2.availability.startAvailabilityCheck();    
    
    $(".select-dropdown-button").on('click', function(e) {
        $("#selectDropDown").width($("#selectDropDownParent").width());
        e.stopPropagation();
        $("#selectDropDown").dropdown('toggle');
    });  
    
    $(".select-dropdown-caret").on('click', function(e) {
        $("#selectDropDown").width($("#selectDropDownParent").width());
        e.stopPropagation();
        $("#selectDropDown").dropdown('toggle');
    }); 
    
    $(".search-dropdown-button").on('click', function() {
        $("#searchDropDown").width($("#searchDropDownParent").width());
    }); 
    
    $('#searchDropDown').on('click', "[data-stop-propagation]", function(e) {
        e.stopPropagation();
    });
    
    //stop date picker's event bubling
    $(document).on('click.dropdown touchstart.dropdown.data-api', '#ui-datepicker-div', function (e) { e.stopPropagation() });

});

$(window).resize(function() {
    $("#selectDropDown").width($("#selectDropDownParent").width());
    $("#searchDropDown").width($("#searchDropDownParent").width());
});

function ajax_login()
{
    $('#login_button').bind('click', function()
    {
        var username = $('#username').val();
        var password = $('#password').val();

        $.post('../dhis-web-commons-security/login.action', {
            'j_username': username,
            'j_password': password
        }).success(function()
        {
            var ret = dhis2.availability.syncCheckAvailability();

            if (!ret)
            {
                alert(i18n_ajax_login_failed);
            }
        });
    });
}

function getUserProfile()
{
    var def = $.Deferred();

    $.ajax({
        url: '../api/me/profile',
        type: 'GET'
    }).done(function(response) {
        localStorage['USER_PROFILE'] = JSON.stringify(response);
        def.resolve();
    });

    return def.promise();
}

function getCalendarSetting()
{
    var def = $.Deferred();

    $.ajax({
        url: '../api/systemSettings?key=keyCalendar&key=keyDateFormat',
        type: 'GET'
    }).done(function(response) {
        localStorage['CALENDAR_SETTING'] = JSON.stringify(response);
        def.resolve();
    });

    return def.promise();
}

function getLoginDetails()
{
    var def = $.Deferred();

    $.ajax({
        url: '../api/me',
        type: 'GET'
    }).done( function(response) {            
        localStorage['LOGIN_DETAILS'] = JSON.stringify(response);           
        def.resolve();
    });
    
    return def.promise(); 
}

function getRelationships()
{
    var def = $.Deferred();

    $.ajax({
        url: '../api/relationshipTypes.json?paging=false&fields=id,name,aIsToB,bIsToA,displayName',
        type: 'GET'
    }).done(function(response) {        
        dhis2.tc.store.setAll( 'relationshipTypes', response.relationshipTypes );
        def.resolve();        
    });

    return def.promise();
}

function getAttributes()
{
    var def = $.Deferred();

    $.ajax({
        url: '../api/trackedEntityAttributes.json',
        type: 'GET',
        data: 'paging=false&fields=id,name,version,description,valueType,inherit,displayOnVisitSchedule,displayInListNoProgram,unique,optionSet[id,version]'
    }).done(function(response) {
        dhis2.tc.store.setAll( 'attributes', response.trackedEntityAttributes );        
        def.resolve(response.trackedEntityAttributes);        
    });

    return def.promise();
}

function getOptionSetsForAttributes( attributes )
{
    if( !attributes ){
        return;
    }
    
    var mainDef = $.Deferred();
    var mainPromise = mainDef.promise();

    var def = $.Deferred();
    var promise = def.promise();

    var builder = $.Deferred();
    var build = builder.promise();    

    _.each( _.values( attributes ), function ( attribute ) {
        if( attribute.optionSet && attribute.optionSet.id ){
            build = build.then(function() {
                var d = $.Deferred();
                var p = d.promise();
                dhis2.tc.store.get('optionSets', attribute.optionSet.id).done(function(obj) {                    
                    if((!obj || obj.version !== attribute.optionSet.version) && !optionSetsInPromise[attribute.optionSet.id]) {
                        optionSetsInPromise[attribute.optionSet.id] = attribute.optionSet.id;
                        promise = promise.then( getOptionSet( attribute.optionSet.id ) );
                    }
                    d.resolve();
                });

                return p;
            });
        }                      
    });

    build.done(function() {
        def.resolve();

        promise = promise.done( function () {
            mainDef.resolve();
        } );
    });

    builder.resolve();

    return mainPromise;    
}

function getTrackedEntities()
{
    var def = $.Deferred();

    $.ajax({
        url: '../api/trackedEntities',
        type: 'GET',
        data: 'viewClass=detailed&paging=false'
    }).done(function(response) {
        dhis2.tc.store.setAll( 'trackedEntities', response.trackedEntities );        
        def.resolve();
    });

    return def.promise();
}

function getMetaPrograms()
{
    var def = $.Deferred();

    $.ajax({
        url: '../api/programs.json',
        type: 'GET',
        data:'filter=type:eq:1&paging=false&fields=id,name,version,programTrackedEntityAttributes[displayInList,mandatory,trackedEntityAttribute[id]],programStages[id,version,programStageDataElements[dataElement[id,optionSet[id,version]]]]'
    }).done( function(response) {          
        var programs = [];
        _.each( _.values( response.programs ), function ( program ) { 
            if( program.programStages &&
                program.programStages.length &&
                program.programStages[0].programStageDataElements &&
                program.programStages[0].programStageDataElements.length ) {
            
                programs.push(program);
            }  
            
        });
        
        def.resolve( programs );
    });
    
    return def.promise(); 
}

function getPrograms( programs )
{
    if( !programs ){
        return;
    }
    
    var mainDef = $.Deferred();
    var mainPromise = mainDef.promise();

    var def = $.Deferred();
    var promise = def.promise();

    var builder = $.Deferred();
    var build = builder.promise();

    _.each( _.values( programs ), function ( program ) {
        build = build.then(function() {
            var d = $.Deferred();
            var p = d.promise();
            dhis2.tc.store.get('trackerCapturePrograms', program.id).done(function(obj) {
                if(!obj || obj.version !== program.version) {
                    promise = promise.then( getProgram( program.id ) );
                }

                d.resolve();
            });

            return p;
        });
    });

    build.done(function() {
        def.resolve();

        promise = promise.done( function () {
            mainDef.resolve( programs );
        } );
    });

    builder.resolve();

    return mainPromise;
}

function getProgram( id )
{
    return function() {
        return $.ajax( {
            url: '../api/programs.json',
            type: 'GET',
            data: 'paging=false&filter=id:eq:' + id +'&fields=id,name,version,dataEntryMethod,relationshipText,relationshipFromA,dateOfEnrollmentDescription,dateOfIncidentDescription,displayIncidentDate,ignoreOverdueEvents,realionshipText,relationshipFromA,selectEnrollmentDatesInFuture,selectIncidentDatesInFuture,onlyEnrollOnce,externalAccess,displayOnAllOrgunit,registration,trackedEntity[id,name,description],userRoles[id,name],organisationUnits[id,name],programStages[id,name,version,minDaysFromStart,standardInterval,generatedByEnrollmentDate,reportDateDescription,repeatable,autoGenerateEvent,openAfterEnrollment,reportDateToUse],programTrackedEntityAttributes[displayInList,mandatory,allowFutureDate,trackedEntityAttribute[id]]'
        }).done( function( response ){
            
            _.each( _.values( response.programs ), function ( program ) { 
                
                var ou = {};
                _.each(_.values( program.organisationUnits), function(o){
                    ou[o.id] = o.name;
                });

                program.organisationUnits = ou;

                var ur = {};
                _.each(_.values( program.userRoles), function(u){
                    ur[u.id] = u.name;
                });

                program.userRoles = ur;

                dhis2.tc.store.set( 'trackerCapturePrograms', program );

            });         
        });
    };
}

function getProgramStages( programs )
{
    if( !programs ){
        return;
    }
    
    var mainDef = $.Deferred();
    var mainPromise = mainDef.promise();

    var def = $.Deferred();
    var promise = def.promise();

    var builder = $.Deferred();
    var build = builder.promise();

    _.each( _.values( programs ), function ( program ) {
        
        _.each(_.values(program.programStages), function(programStage){
            build = build.then(function() {
                var d = $.Deferred();
                var p = d.promise();
                dhis2.tc.store.get('programStages', programStage.id).done(function(obj) {
                    if(!obj || obj.version !== programStage.version) {
                        promise = promise.then( getProgramStage( programStage.id ) );
                    }
                    d.resolve();
                });
                return p;
            });            
        });                     
    });

    build.done(function() {
        def.resolve();

        promise = promise.done( function () {
            mainDef.resolve( programs );
        } );
    });

    builder.resolve();

    return mainPromise;    
}

function getProgramStage( id )
{
    return function() {
        return $.ajax( {
            url: '../api/programStages.json',
            type: 'GET',
            data: 'filter=id:eq:' + id +'&fields=id,name,version,dataEntryForm,captureCoordinates,blockEntryForm,autoGenerateEvent,openAfterEnrollment,reportDateToUse,reportDateDescription,minDaysFromStart,standardInterval,repeatable,programStageDataElements[displayInReports,allowProvidedElsewhere,allowFutureDate,compulsory,dataElement[id,name,formName,type,optionSet[id]]]'
        }).done( function( response ){            
            _.each( _.values( response.programStages ), function( programStage ) {
                dhis2.tc.store.set( 'programStages', programStage );
            });
        });
    };
}

function getOptionSetsForPrograms( programs )
{
    if( !programs ){
        return;
    }
    
    var mainDef = $.Deferred();
    var mainPromise = mainDef.promise();

    var def = $.Deferred();
    var promise = def.promise();

    var builder = $.Deferred();
    var build = builder.promise();    

    _.each( _.values( programs ), function ( program ) {
        _.each(_.values( program.programStages), function( programStage) {
            _.each(_.values( programStage.programStageDataElements), function(prStDe){            
                if( prStDe.dataElement.optionSet && prStDe.dataElement.optionSet.id ){
                    build = build.then(function() {
                        var d = $.Deferred();
                        var p = d.promise();
                        dhis2.tc.store.get('optionSets', prStDe.dataElement.optionSet.id).done(function(obj) {                            
                            if((!obj || obj.version !== prStDe.dataElement.optionSet.version) && !optionSetsInPromise[prStDe.dataElement.optionSet.id]) {                                
                                optionSetsInPromise[prStDe.dataElement.optionSet.id] = prStDe.dataElement.optionSet.id;                                
                                promise = promise.then( getOptionSet( prStDe.dataElement.optionSet.id ) );
                            }
                            d.resolve();
                        });

                        return p;
                    });
                }            
            });
        });                              
    });

    build.done(function() {
        def.resolve();

        promise = promise.done( function () {
            mainDef.resolve( programs );
        } );
    });

    builder.resolve();

    return mainPromise;    
}

function getOptionSet( id )
{
    return function() {
        return $.ajax( {
            url: '../api/optionSets.json',
            type: 'GET',
            data: 'filter=id:eq:' + id +'&fields=id,name,version,options[id,name,code]'
        }).done( function( response ){            
            _.each( _.values( response.optionSets ), function( optionSet ) {                
                dhis2.tc.store.set( 'optionSets', optionSet );
            });
        });
    };
}


function getMetaTrackedEntityForms()
{
    var def = $.Deferred();

    $.ajax({
        url: '../api/trackedEntityForms.json',
        type: 'GET',
        data:'paging=false&fields=id,program[id]'
    }).done( function(response) {          
        var trackedEntityForms = [];
        _.each( _.values( response.trackedEntityForms ), function ( trackedEntityForm ) { 
            if( trackedEntityForm &&
                trackedEntityForm.id &&
                trackedEntityForm.program &&
                trackedEntityForm.program.id ) {
            
                trackedEntityForms.push( trackedEntityForm );
            }  
            
        });
        
        def.resolve( trackedEntityForms );
    });
    
    return def.promise(); 
    
}

function getTrackedEntityForms( trackedEntityForms )
{
    if( !trackedEntityForms ){
        return;
    }
    
    var mainDef = $.Deferred();
    var mainPromise = mainDef.promise();

    var def = $.Deferred();
    var promise = def.promise();

    var builder = $.Deferred();
    var build = builder.promise();

    _.each( _.values( trackedEntityForms ), function ( trackedEntityForm ) {
        build = build.then(function() {
            var d = $.Deferred();
            var p = d.promise();
            dhis2.tc.store.get('trackedEntityForms', trackedEntityForm.program.id).done(function(obj) {
                if(!obj) {
                    promise = promise.then( getTrackedEntityForm( trackedEntityForm.id ) );
                }
                d.resolve();
            });

            return p;
        });
    });

    build.done(function() {
        def.resolve();

        promise = promise.done( function () {
            mainDef.resolve();
        } );
    });

    builder.resolve();

    return mainPromise;
}

function getTrackedEntityForm( id )
{
    return function() {
        return $.ajax( {
            url: '../api/trackedEntityForms.json',
            type: 'GET',
            data: 'paging=false&filter=id:eq:' + id +'&fields=id,program[id,name],dataEntryForm[name,htmlCode]'
        }).done( function( response ){
            
            _.each( _.values( response.trackedEntityForms ), function ( trackedEntityForm ) { 
                
                if( trackedEntityForm &&
                    trackedEntityForm.id &&
                    trackedEntityForm.program &&
                    trackedEntityForm.program.id ) {

                    trackedEntityForm.id = trackedEntityForm.program.id;
                    dhis2.tc.store.set( 'trackedEntityForms', trackedEntityForm );
                }
            });
        });
    };
}

function uploadLocalData()
{
    if (!dhis2.tc.storageManager.hasLocalData())
    {
        return;
    }

    setHeaderWaitMessage(i18n_uploading_data_notification);

    var events = dhis2.tc.storageManager.getEventsAsArray();

    _.each(_.values(events), function(event) {

        if (event.hasOwnProperty('src')) {
            if (event.src == 'local') {
                delete event.event;
            }

            delete event.src;
        }
    });

    events = {eventList: events};

    //jackson insists for valid json, where properties are bounded with ""    
    events = JSON.stringify(events);

    $.ajax({
        url: '../api/events.json',
        type: 'POST',
        data: events,
        contentType: 'application/json',
        success: function()
        {
            dhis2.tc.storageManager.clear();
            log('Successfully uploaded local events');
            setHeaderDelayMessage(i18n_sync_success);
            //selection.responseReceived(); //notify angular 
        },
        error: function(xhr)
        {
            if (409 == xhr.status) // Invalid event
            {
                // there is something wrong with the data - ignore for now.

                dhis2.tc.storageManager.clear();
            }
            else // Connection lost during upload
            {
                var message = i18n_sync_failed
                        + ' <button id="sync_button" type="button">' + i18n_sync_now + '</button>';

                setHeaderMessage(message);
                $('#sync_button').bind('click', uploadLocalData);
            }
        }
    });
}

// -----------------------------------------------------------------------------
// StorageManager
// -----------------------------------------------------------------------------

/**
 * This object provides utility methods for localStorage and manages data entry
 * forms and data values.
 */
function StorageManager()
{
    var MAX_SIZE = new Number(2600000);

    /**
     * Returns the total number of characters currently in the local storage.
     *
     * @return number of characters.
     */
    this.totalSize = function()
    {
        var totalSize = new Number();

        for (var i = 0; i < localStorage.length; i++)
        {
            var value = localStorage.key(i);

            if (value)
            {
                totalSize += value.length;
            }
        }

        return totalSize;
    };

    /**
     * Return the remaining capacity of the local storage in characters, ie. the
     * maximum size minus the current size.
     */
    this.remainingStorage = function()
    {
        return MAX_SIZE - this.totalSize();
    };

    /**
     * Clears stored events. 
     */
    this.clear = function()
    {
        localStorage.removeItem(TRACKER_VALUES);
    };

    /**
     * Saves an event
     *
     * @param event The event in json format.
     */
    this.saveEvent = function(event)
    {
        //var newEvent = event;

        if (!event.hasOwnProperty('src'))
        {
            if (!event.event) {
                event.event = this.generatePseudoUid();
                event.src = 'local';
            }
        }

        var events = {};

        if (localStorage[TRACKER_VALUES] != null)
        {
            events = JSON.parse(localStorage[TRACKER_VALUES]);
        }

        events[event.event] = event;

        try
        {
            localStorage[TRACKER_VALUES] = JSON.stringify(events);

            log('Successfully stored event - locally');
        }
        catch (e)
        {
            log('Max local storage quota reached, not storing data value locally');
        }
    };

    /**
     * Gets the value for the event with the given arguments, or null if it
     * does not exist.
     *
     * @param id the event identifier.
     *
     */
    this.getEvent = function(id)
    {
        if (localStorage[TRACKER_VALUES] != null)
        {
            var events = JSON.parse(localStorage[TRACKER_VALUES]);

            return events[id];
        }

        return null;
    };

    /**
     * Removes the given event from localStorage.
     *
     * @param event and identifiers in json format.
     */
    this.clearEvent = function(event)
    {
        var events = this.getAllEvents();

        if (events != null && events[event.event] != null)
        {
            delete events[event.event];
            localStorage[TRACKER_VALUES] = JSON.stringify(events);
        }
    };

    /**
     * Returns events matching the arguments provided
     * 
     * @param orgUnit 
     * @param programStage
     * 
     * @return a JSON associative array.
     */
    this.getEvents = function(orgUnit, programStage)
    {
        var events = this.getEventsAsArray();
        var match = [];
        for (var i = 0; i < events.length; i++) {
            if (events[i].orgUnit == orgUnit && events[i].programStage == programStage) {
                match.push(events[i]);
            }
        }

        return match;
    };

    /**
     *
     * @return a JSON associative array.
     */
    this.getAllEvents = function()
    {
        return localStorage[TRACKER_VALUES] != null ? JSON.parse(localStorage[TRACKER_VALUES]) : null;
    };

    /**
     * Returns all event objects in an array. Returns an empty array if no
     * event exist. Items in array are guaranteed not to be undefined.
     */
    this.getEventsAsArray = function()
    {
        var values = new Array();
        var events = this.getAllEvents();

        if (undefined == events)
        {
            return values;
        }

        for (i in events)
        {
            if (events.hasOwnProperty(i) && undefined !== events[i])
            {
                values.push(events[i]);
            }
        }

        return values;
    };

    /**
     * Indicates whether there exists data values or complete data set
     * registrations in the local storage.
     *
     * @return true if local data exists, false otherwise.
     */
    this.hasLocalData = function()
    {
        var events = this.getAllEvents();

        if (events == null)
        {
            return false;
        }
        if (Object.keys(events).length < 1)
        {
            return false;
        }

        return true;
    };

    this.generatePseudoUid = function()
    {
        return Math.random().toString(36).substr(2, 11);
    };
}