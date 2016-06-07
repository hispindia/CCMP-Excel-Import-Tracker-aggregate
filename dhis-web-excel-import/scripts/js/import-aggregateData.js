/**
 *
 */
var AggregateExcelCellMap = new Object();
var aggImportCount = 6;
var endRowNo = 0 ;
var successCount = 0;
var period = "";
var yearlyPeriod = "";

var month_store = new Object();
    month_store['January'] = '01';
    month_store['February'] = '02';
    month_store['March'] = '03';
    month_store['April'] = '04';
    month_store['May'] = '05';
    month_store['June'] = '06';
    month_store['July'] = '07';
    month_store['August'] = '08';
    month_store['September'] = '09';
    month_store['October'] = '10';
    month_store['November'] = '11';
    month_store['December'] = '12';


function importData(sheetName){
    // import data
    console.log('sheet Name '+ sheetName);
    endRowNo = $('#rowno').val();
    var month_year = $('#month').val().split(' ');
    yearlyPeriod = month_year[1];
    period = month_year[1]+''+month_store[month_year[0]];

    console.log('yearlyPeriod :'+yearlyPeriod);
    console.log('period :'+period);

    $('#summary > tbody').html('');

    //var url = 'aggregateDataImport.action';
    var url = '../dhis-web-apps/aggregateDataImport.action';
    $( '#contentDiv' ).load( url, function(responseTxt, statusTxt, xhr)
    {
        if(statusTxt == "success"){
            console.log("ajax call return successfully!");
            $('#importAlertContent').text('Data import complete. Thanks for your patience ');
            $('#back').show();
        }
        if(statusTxt == "error")
            console.log("Error: " + xhr.status + ": " + xhr.statusText);
    });
}

function importAggregateExcelData(dataValueSet ,rowNo){
    ++aggImportCount;

    $.ajax( {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        url: '../api/dataValueSets',
        data: JSON.stringify(dataValueSet),
        dataType: 'json',
        type: 'post',
        async:false,
        success: handleRegistrationSuccess,
        error: handleRegistrationError
    } );

    function handleRegistrationSuccess(data)
    {
        console.log(data);

        var importedDataValueCount = data.importCount.imported,
            updatedDataValueCount = data.importCount.updated,
            ignoredDataValueCount = data.importCount.ignored;

        console.log(importedDataValueCount, updatedDataValueCount, ignoredDataValueCount);

        if(data.status == "Conflict")
        {
            var errorValue =  data.conflicts[0].value;

            $('#summary > tbody:last').append('<tr class="alert-info" ><td>Details Info</td><td> <b> Imported</b> = '+importedDataValueCount+' <b> Updated</b> = '+updatedDataValueCount+'<b> Ignored</b> = '+ignoredDataValueCount+' for row number :<b>'+ ( rowNo + 1) +'</b>. Please check this row for any missing/incorrect value  </td><td></td></tr>');
       //   $('#summary > tbody:last').append('<tr class="alert-info" ><td>Details Info</td><td> Please check this row for any missing/incorrect value <b>'+ (rowNo + 1) +'</b>.  </td><td></td></tr>');

            console.log('error while Registration :'+errorValue);
        }
        else if( data.status == "SUCCESS")
        {
            //console.log(aggImportCount+':'+endRowNo);
            ++successCount;

            console.log(aggImportCount+':'+endRowNo + ':' + successCount);

            if( (aggImportCount) == endRowNo)
            {
                $('#summary > tbody:last').append('<tr class="alert-success" ><td>Success</td><td>'+successCount+'</td><td></td></tr>');
            }
        }

    }

    function handleRegistrationError( textStatus, errorThrown )
    {
            console.log('Registration Error'+textStatus);
            console.log(errorThrown);
            $('#summary > tbody:last').append('<tr class="warning" ><td>Failed</td><td>1</td><td>Error while Registration, Incomplete attributes/ values not in proper format for row: <b>'+(rowNo + 1)+'</b></td></tr>');
    }

}


function to_Map(workbook) {
    workbook.SheetNames.forEach(function(sheetName) {
        AggregateExcelCellMap = XLSX.utils.sheet_to_formulae(workbook.Sheets[sheetName]);

        var sheet = workbook.Sheets[sheetName];
        var R = XLSX.utils.get_length(sheet['!ref']);
        console.log('last row '+ R.e.r);
        //alert( " 11 1 " + ExcelCellMap );

        if(AggregateExcelCellMap != undefined)
        {
            importData(sheetName);
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

    if (!file)
    {
        alert("Error Cannot find the file!");
        return;
    }
    else if(extension.toLowerCase() != 'xlsx')
    {
        alert('select file with extension .xlsx only!');
        return;
    }
    else
    {
        $('#mainDiv').hide();
        $('#mothPick').hide();
        $('#notification_bar').hide();

        $('#summaryDiv').show();
        $('#alertDiv').show();

    }

    var rABS = true;
    var use_worker = true;

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
    aggImportCount = 6;
    successCount = 0;
    $('#mothPick').show();
    $('#notification_bar').show();
    $('#mainDiv').show();
    $('#summaryDiv').hide();
    $('#alertDiv').hide();
    $('#rowno').val('');
    $('#import').attr('disabled', true);
}