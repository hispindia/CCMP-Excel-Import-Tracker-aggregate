var ExcelCellMap = new Object();
var endRow = 0 ;
var importCount = 0;
var lastRowNo = 0 ;
//var successCount = 0;
var successCount = 0;

function importProgramStageData(sheetName, lastRow){
    // import data
    console.log('sheet Name '+ sheetName);
    endRow = lastRow;
    lastRowNo = $('#rowno').val();
    
    //alert( "EndRow " + lastRowNo );
    
    $('#summary > tbody').html('');
    
    var url = '../dhis-web-apps/importProgramStageData.action';
    //var url = 'dhis-web-apps/importData.action';
    
    //alert( "URL " + url );
    
    $( '#contentDiv' ).load( url, function(responseTxt, statusTxt, xhr)
    {
        if(statusTxt == "success"){
            console.log("ajax call return successfully!");
            $('#back').show();
            $('#importAlertContent').text('Data import complete. Thanks for your patience');
        }
        if(statusTxt == "error")
            console.log("Error: " + xhr.status + ": " + xhr.statusText);
    });
}

function importExcelData(trackedEntityInstanceObj, enrollmentObj, eventObj, row){
    var errorCount = 0;
    importCount++;

    $.ajax( {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        url: '../api/trackedEntityInstances',
        data: JSON.stringify(trackedEntityInstanceObj),
        dataType: 'json',
        type: 'post',
        async:false,
        success: handleRegistrationSuccess,
        error: handleRegistrationError
    } );

    function handleRegistrationSuccess(data)
    {
        //registration success go for enrollment
        var trackedEntityInstance='';
        var enrollmentId='';

        if(data.conflicts != undefined)
        { //when duplicate occurs conflict occurs
            var errorValue =  data.conflicts[0].value;
            var Uid = errorValue.split(" ").pop();
                errorCount++;

            if(Uid === 'DRE6dcyds2D'){
                errorValue = errorValue.replace(Uid, '<b>Patient Id</b>');
                $('#summary > tbody:last').append('<tr class="alert-info" ><td>Failed</td><td>1</td><td>'+errorValue+'</td></tr>');
            }else
            {
                $('#summary > tbody:last').append('<tr class="alert-info" ><td>Failed</td><td>1</td><td>Registration attributes are Incomplete/found duplicate for row: <b>'+(row + 1)+' </b></td></tr>');
            }

            console.log('error while Registration :'+errorValue);
        }



        else if(data.response.reference != undefined)
        { // for unique entry

            trackedEntityInstance = data.response.reference;
            console.log('Person Registered successfully! with tracked entity instance id: '+trackedEntityInstance);

            enrollmentObj.trackedEntityInstance = trackedEntityInstance;

            //enrollmentObj.enrollmentDate = enrollmentObj.dateOfEnrollment;
            //enrollmentObj.incidentDate = enrollmentObj.enrollmentDate;

            $.ajax( {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                url: '../api/enrollments',
                data: JSON.stringify(enrollmentObj),
                dataType: 'json',
                type: 'post',
                async: false,
                success: handleEnrollmentSuccess,
                error: handleEnrollmentError
            } );
        }

        function handleEnrollmentSuccess(data)
        {
            //enrollment success go for event

            if(data.conflicts != undefined)  //when duplicate occurs conflict occurs
            {
                var errorValue =  data.conflicts[0].value;

                console.log('error while enrollment :'+errorValue);
            }
            else if(data.response.importSummaries[0].reference != undefined)   // for unique entry
            {
                //enrollmentId = data.reference;
                enrollmentId = data.response.importSummaries[0].reference;
                console.log('Person Enrolled successfully! with enrollment id: '+enrollmentId);
                eventObj.trackedEntityInstance = trackedEntityInstance ;

                $.ajax( {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    url: '../api/events',
                    data: JSON.stringify(eventObj),
                    dataType: 'json',
                    type: 'post',
                    async: false,
                    success: handleEventSuccess,
                    error: handleEventError
                } );
            }
        }
        function handleEventSuccess(data)
        {
            if(data.response.importSummaries[0].status === 'SUCCESS') //when duplicate occurs conflict occurs
            {
                console.log(importCount+':'+successCount);

                successCount++;

                if((importCount + 1 ) == lastRowNo){
                    $('#summary > tbody:last').append('<tr classs="alert-success" ><td>Success</td><td>'+( successCount )+'</td><td>NA</td></tr>');
                }
                console.log('Event created successfully!');
            }
          }

        function handleEventError(textStatus,errorThrown)
        {
            console.log('Creating event Error '+textStatus);
            console.log(errorThrown);
            $('#summary > tbody:last').append('<tr class="alert-danger" ><td>Failed</td><td>1</td><td>Error while creating event</td></tr>');
        }

        function handleEnrollmentError(textStatus,errorThrown)
        {
            console.log('Enrollment Error '+textStatus);
            console.log(errorThrown);
            $('#summary > tbody:last').append('<tr class="alert-danger" ><td>Failed</td><td>1</td><td>Error while Enrollment</td></tr>');
        }
    }
    function handleRegistrationError( textStatus, errorThrown )
    {
        console.log('Registration Error'+textStatus);
        console.log(errorThrown);
        $('#summary > tbody:last').append('<tr class="alert-danger" ><td>Failed</td><td>1</td><td>Error while Registration, Incomplete attributes/ values not in proper format for row: <b>'+(row + 1)+'</b></td></tr>');
    }
}

function to_Map(workbook) {
    workbook.SheetNames.forEach(function(sheetName) {
        ExcelCellMap = XLSX.utils.sheet_to_formulae(workbook.Sheets[sheetName]);

        var sheet = workbook.Sheets[sheetName];
        var R = XLSX.utils.get_length(sheet['!ref']);
        console.log('last row '+ R.e.r);
        //alert( " 11 1 " + ExcelCellMap );

        if(ExcelCellMap != undefined){
            //alert( " 2222  " + ExcelCellMap );
            //alert( " 3333  " + ExcelCellMap[] );
            importProgramStageData(sheetName, R.e.r);
        }
    });
}

function fixdata(data) {
    var o = "", l = 0, w = 10240;
    for(; l<data.byteLength/w; ++l) o+=String.fromCharCode.apply(null,new Uint8Array(data.slice(l*w,l*w+w)));
    o+=String.fromCharCode.apply(null, new Uint8Array(data.slice(l*w)));
    return o;
}

function xlsxworker(data) {
    var rABS = true;
    var worker = new Worker('./scripts/js/xlsxworker.js');
    worker.onmessage = function(e) {
        switch(e.data.t) {
            case 'ready': break;
            case 'e': console.error(e.data.d); break;
            default : to_Map(JSON.parse(e.data.d)); break;
        }
    };
    var arr = rABS ? data : btoa(fixdata(data));
    worker.postMessage({d:arr,b:rABS});
}

function uploadFile(){

    var file = document.getElementById('fileInput').files[0];

    var filename = $('#fileInput').val().split('\\').pop();
    var extension = filename.split('.').pop();

    if (!file) {
        alert("Error Cannot find the file!");
        return;
    }
    else if(extension.toLowerCase() != 'xlsx'){
        alert('select file with extension .xlsx only!');
        return;
    }else
    {
        $('#mainDiv').hide();
        $('#infoAlert').hide();
        $('#summaryDiv').show();
        $('#alertDiv').show();

    }

    var rABS = true;
    var   use_worker = true;

    var reader = new FileReader();
    reader.onload = function(e) {
        var data = e.target.result;
        if(use_worker) {
            xlsxworker(data);
        } else {
            var wb;
            if(rABS) {
                wb = XLSX.read(data, {type: 'binary'});
            } else {
                var arr = fixdata(data);
                wb = XLSX.read(btoa(arr), {type: 'base64'});
            }
        }
    };
    if(rABS) reader.readAsBinaryString(file);
    else reader.readAsArrayBuffer(file);
}

function cancel(){
    //alert('hello');
}

function goback(){
    importCount = 0;
    //successCount = 0;
    successCount = 0;
    $('#infoAlert').show();
    $('#mainDiv').show();
    $('#summaryDiv').hide();
    $('#alertDiv').hide();
    $('#rowno').val('');
    $('#import').attr('disabled', true);
}