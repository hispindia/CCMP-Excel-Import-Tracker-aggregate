trackerCapture.controller('ProfileController',
        function($rootScope,
                $scope,     
                CurrentSelection,
                DateUtils,
                TEIService,
                DialogService,
                AttributesFactory,
                TranslationService) {

    TranslationService.translate();
    
    //attributes for profile    
    $scope.attributes = [];    
    $scope.editProfile = false;    
    
    AttributesFactory.getAll().then(function(atts){
        angular.forEach(atts, function(att){
            $scope.attributes[att.id] = att;
        }); 
    }); 
    
    //listen for the selected entity       
    $scope.$on('dashboardWidgets', function(event, args) { 
        var selections = CurrentSelection.get();
        $scope.selectedTei = angular.copy(selections.tei);

        $scope.trackedEntity = selections.te;
        $scope.selectedProgram = selections.pr;   
        $scope.selectedEnrollment = selections.enrollment;
        $scope.optionSets = selections.optionSets;

        //display only those attributes that belong to the selected program
        //if no program, display attributesInNoProgram
        TEIService.processAttributes($scope.selectedTei, $scope.selectedProgram, $scope.selectedEnrollment, $scope.optionSets).then(function(tei){
            $scope.selectedTei = tei;
        });
    });
    
    $scope.enableEdit = function(){
        $scope.entityAttributes = angular.copy($scope.selectedTei.attributes);
        $scope.editProfile = !$scope.editProfile; 
        $rootScope.profileWidget.expand = true;
    };
    
    $scope.save = function(){        
        
        //check for form validity
        $scope.outerForm.submitted = true;        
        if( $scope.outerForm.$invalid ){
            return false;
        }

        //form is valid, continue the update process        
        //get tei attributes and their values
        //but there could be a case where attributes are non-mandatory and
        //form comes empty, in this case enforce at least one value
        $scope.formEmpty = true;
        var tei = angular.copy($scope.selectedTei);
        tei.attributes = [];
        angular.forEach($scope.selectedTei.attributes, function(attribute){
            if(attribute.type === 'trueOnly'){ 
                if(!attribute.value){
                    tei.attributes.push({attribute: attribute.attribute, value: ''});
                    $scope.formEmpty = false;                    
                }
                else{
                    tei.attributes.push({attribute: attribute.attribute, value: 'true'});
                    $scope.formEmpty = false;
                }
            }            
            else{
                var val = attribute.value;
                if(!angular.isUndefined(val) && val !== ''){
                    if(attribute.type === 'date'){   
                        val = DateUtils.formatFromUserToApi(val);
                    }
                    if(attribute.type === 'optionSet' && $scope.optionSets.optionCodesByName[  '"' + val + '"']){   
                        val = $scope.optionSets.optionCodesByName[  '"' + val + '"'];
                    }                    
                    $scope.formEmpty = false;
                }
                tei.attributes.push({attribute: attribute.attribute, value: val});
            }           
             
        });
        
        if($scope.formEmpty){
            //form is empty            
            return false;
        }

        TEIService.update(tei).then(function(updateResponse){
            
            if(updateResponse.status !== 'SUCCESS'){//update has failed
                var dialogOptions = {
                        headerText: 'update_error',
                        bodyText: updateResponse.description
                    };
                DialogService.showDialog({}, dialogOptions);
                return;
            }
            
            $scope.editProfile = !$scope.editProfile;
            CurrentSelection.set({tei: $scope.selectedTei, te: $scope.trackedEntity, pr: $scope.selectedProgram, enrollment: $scope.selectedEnrollment, optionSets: $scope.optionSets});   
            $scope.outerForm.submitted = false; 
        });
    };
    
    $scope.cancel = function(){
        $scope.selectedTei.attributes = $scope.entityAttributes;  
        $scope.editProfile = !$scope.editProfile;
    };
});