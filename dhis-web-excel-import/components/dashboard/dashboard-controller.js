//Controller for dashboard
trackerCapture.controller('DashboardController',
        function($rootScope,
                $scope,
                $location,
                $modal,
                $timeout,
                storage,
                TEIService, 
                TEService,
                OptionSetFactory,
                ProgramFactory,
                CurrentSelection,
                TranslationService) {

    //do translation of the dashboard page
    TranslationService.translate();    
 
    //dashboard items   
    $rootScope.biggerDashboardWidgets = [];
    $rootScope.smallerDashboardWidgets = [];
    $rootScope.enrollmentWidget = {title: 'enrollment', view: "components/enrollment/enrollment.html", show: true, expand: true};
    $rootScope.dataentryWidget = {title: 'dataentry', view: "components/dataentry/dataentry.html", show: true, expand: true};
    $rootScope.reportWidget = {title: 'report', view: "components/report/tei-report.html", show: true, expand: true};
    $rootScope.selectedWidget = {title: 'current_selections', view: "components/selected/selected.html", show: false, expand: true};
    $rootScope.profileWidget = {title: 'profile', view: "components/profile/profile.html", show: true, expand: true};
   // $rootScope.relationshipWidget = {title: 'relationships', view: "components/relationship/relationship.html", show: true, expand: true};
  //  $rootScope.notesWidget = {title: 'notes', view: "components/notes/notes.html", show: true, expand: true};
   
    $rootScope.biggerDashboardWidgets.push($rootScope.enrollmentWidget);
    $rootScope.biggerDashboardWidgets.push($rootScope.dataentryWidget);
    $rootScope.biggerDashboardWidgets.push($rootScope.reportWidget);
    $rootScope.smallerDashboardWidgets.push($rootScope.selectedWidget);
    $rootScope.smallerDashboardWidgets.push($rootScope.profileWidget);
  //  $rootScope.smallerDashboardWidgets.push($rootScope.relationshipWidget);
  //  $rootScope.smallerDashboardWidgets.push($rootScope.notesWidget);
    
    //selections  
    $scope.selectedTeiId = ($location.search()).tei; 
    $scope.selectedProgramId = ($location.search()).program; 
    $scope.selectedOrgUnit = storage.get('SELECTED_OU');

    $scope.selectedProgram;    
    $scope.selectedTei;    
    
    if($scope.selectedTeiId){
        //Fetch the selected entity
        TEIService.get($scope.selectedTeiId).then(function(data){
            $scope.selectedTei = data;
            
            //get the entity type
            TEService.get($scope.selectedTei.trackedEntity).then(function(te){
                $scope.trackedEntity = te;
                
                ProgramFactory.getAll().then(function(programs){  
                    
                    $scope.programs = []; 
                    //get programs valid for the selected ou and tei
                    angular.forEach(programs, function(program){
                        if(program.organisationUnits.hasOwnProperty($scope.selectedOrgUnit.id) &&
                           program.trackedEntity.id === $scope.selectedTei.trackedEntity){
                            $scope.programs.push(program);
                        }

                        if($scope.selectedProgramId && program.id === $scope.selectedProgramId){
                            $scope.selectedProgram = program;
                        }
                    });
                    
                    $scope.optionSets = {optionSets: [], optionNamesByCode: new Object(), optionCodesByName: new Object()};
                    OptionSetFactory.getAll().then(function(optionSets){
                        angular.forEach(optionSets, function(optionSet){
                            angular.forEach(optionSet.options, function(option){
                                if(option.name && option.code){
                                    $scope.optionSets.optionNamesByCode[ '"' + option.code + '"'] = option.name;
                                    $scope.optionSets.optionCodesByName[ '"' + option.name + '"'] = option.code;
                                }                       
                            });
                            $scope.optionSets.optionSets[optionSet.id] = optionSet;
                        });
                        
                        //broadcast selected items for dashboard controllers
                        CurrentSelection.set({tei: $scope.selectedTei, te: $scope.trackedEntity, pr: $scope.selectedProgram, enrollment: null, optionSets: $scope.optionSets});
                        $scope.broadCastSelections();  
                    });
                });
            });            
        });      
    }    
    
    //listen for any change to program selection
    //it is possible that such could happen during enrollment.
    $scope.$on('mainDashboard', function(event, args) { 
        var selections = CurrentSelection.get();
        $scope.selectedProgram = null;
        angular.forEach($scope.programs, function(pr){
            if(pr.id === selections.pr){
                $scope.selectedProgram = pr;
            }
        });
        $scope.broadCastSelections(); 
    }); 
    
    $scope.broadCastSelections = function(){
        
        var selections = CurrentSelection.get();
        $scope.selectedTei = selections.tei;
        $scope.trackedEntity = selections.te;
        $scope.optionSets = selections.optionSets;
        
        CurrentSelection.set({tei: $scope.selectedTei, te: $scope.trackedEntity, pr: $scope.selectedProgram, enrollment: null, optionSets: $scope.optionSets});
        $timeout(function() { 
            $rootScope.$broadcast('selectedItems', {programExists: $scope.programs.length > 0});            
        }, 100); 
    };     
    
    $scope.back = function(){
        $location.path('/').search({program: $scope.selectedProgramId});                   
    };
    
    $scope.displayEnrollment = false;
    $scope.showEnrollment = function(){
        $scope.displayEnrollment = true;
    };
    
    $scope.removeWidget = function(widget){        
        widget.show = false;
    };
    
    $scope.expandCollapse = function(widget){
        widget.expand = !widget.expand;
    };
    
    $scope.showHideWidgets = function(){
        var modalInstance = $modal.open({
            templateUrl: "components/dashboard/dashboard-widgets.html",
            controller: "DashboardWidgetsController"
        });

        modalInstance.result.then(function () {
        });
    };
});
