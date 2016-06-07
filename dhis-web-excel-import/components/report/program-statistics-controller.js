trackerCapture.controller('ProgramStatisticsController',
         function($scope,
                DateUtils,                
                EnrollmentService,
                TranslationService,
                ProgramFactory,
                DHIS2EventFactory,
                storage) {

    TranslationService.translate();
    
    $scope.today = DateUtils.getToday();
    
    $scope.ouModes = [{name: 'SELECTED'}, {name: 'CHILDREN'}, {name: 'DESCENDANTS'}, {name: 'ACCESSIBLE'}];         
    $scope.selectedOuMode = $scope.ouModes[0];
    $scope.report = {};
    
    $scope.displayMode = {};
    $scope.printMode = false;
    
    //Paging
    $scope.pager = {pageSize: 50, page: 1, toolBarDisplay: 5};
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {        
        if( angular.isObject($scope.selectedOrgUnit)){            
            storage.set('SELECTED_OU', $scope.selectedOrgUnit);            
            $scope.loadPrograms($scope.selectedOrgUnit);
        }
    });
    
    //load programs associated with the selected org unit.
    $scope.loadPrograms = function(orgUnit) {
        $scope.selectedOrgUnit = orgUnit;        
        if (angular.isObject($scope.selectedOrgUnit)){
            ProgramFactory.getAll().then(function(programs){
                $scope.programs = programs;                
                if($scope.programs.length === 1){
                    $scope.selectedProgram = $scope.programs[0];
                } 
            });
        }        
    };    
    
    //watch for selection of program
    $scope.$watch('selectedProgram', function() {   
        if( angular.isObject($scope.selectedProgram)){            
            $scope.reportStarted = false;
            $scope.dataReady = false;
        }
    });
    
    $scope.xFunction = function(){
        return function(d) {
            return d.key;
        };
    };
    
    $scope.yFunction = function(){
        return function(d){
            return d.y;
        };
    };

    $scope.generateReport = function(program, report, ouMode){
        
        $scope.selectedProgram = program;
        $scope.report = report;
        $scope.selectedOuMode = ouMode;

        //check for form validity
        $scope.outerForm.submitted = true;        
        if( $scope.outerForm.$invalid || !$scope.selectedProgram){
            return false;
        }
        
        $scope.dataReady = false;
        $scope.reportStarted = true;        
        

        $scope.enrollments = {active: 0, completed: 0, cancelled: 0};
        $scope.enrollmentList = [];
        EnrollmentService.getByStartAndEndDate($scope.selectedProgram.id,
                                        $scope.selectedOrgUnit.id, 
                                        $scope.selectedOuMode.name,
                                        DateUtils.formatFromUserToApi($scope.report.startDate), 
                                        DateUtils.formatFromUserToApi($scope.report.endDate)).then(function(data){

            $scope.totalEnrollment = data.enrollments.length;                                
            angular.forEach(data.enrollments, function(en){
                $scope.enrollmentList[en.enrollment] = en;
                if(en.status === 'ACTIVE'){
                    $scope.enrollments.active++;
                }
                else if(en.status === 'COMPLETED'){
                    $scope.enrollments.completed++;
                }
                else{
                    $scope.enrollments.cancelled++;
                }
            });
            
            $scope.enrollmentStat = [{key: 'Completed', y: $scope.enrollments.completed},
                                    {key: 'Active', y: $scope.enrollments.active},
                                    {key: 'Cancelled', y: $scope.enrollments.cancelled}];
            
            DHIS2EventFactory.getByOrgUnitAndProgram($scope.selectedOrgUnit.id, $scope.selectedOuMode.name, $scope.selectedProgram.id, null, null).then(function(data){
                                                        
                $scope.dhis2Events = {completed: 0, active: 0, skipped: 0, overdue: 0, ontime: 0};
                $scope.totalEvents = 0;
                angular.forEach(data, function(ev){
                    
                    if(ev.trackedEntityInstance && $scope.enrollmentList[ev.enrollment]){                        
                        
                        $scope.totalEvents++;
                        if(ev.status === 'COMPLETED'){
                            $scope.dhis2Events.completed++;
                        }
                        else if(ev.status === 'ACTIVE'){
                            $scope.dhis2Events.active++;
                        }
                        else if(ev.status === 'SKIPPED'){
                            $scope.dhis2Events.skipped++;
                        }                        
                        else{
                            if(ev.dueDate && moment($scope.today).isAfter(DateUtils.formatFromApiToUser(ev.dueDate))){
                                $scope.dhis2Events.overdue++;
                            }
                            else{
                                $scope.dhis2Events.ontime++;
                            }
                        }
                    }
                });
                $scope.eventStat = [{key: 'Completed', y: $scope.dhis2Events.completed},
                                    {key: 'Active', y: $scope.dhis2Events.active},
                                    {key: 'Skipped', y: $scope.dhis2Events.skipped},
                                    {key: 'Ontime', y: $scope.dhis2Events.overdue},
                                    {key: 'Overdue', y: $scope.dhis2Events.ontime}];
                
                $scope.reportStarted = false;
                $scope.dataReady = true; 
            });            
        });
    };    
});