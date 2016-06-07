trackerCapture.controller('RelationshipController',
        function($scope,
                $rootScope,
                $modal,                
                $location,
                $route,
                CurrentSelection,
                RelationshipFactory,
                TranslationService) {

    TranslationService.translate();        

    $rootScope.showAddRelationshipDiv = false;
    $scope.relationshipTypes = []; 
    $scope.relationships = [];
    RelationshipFactory.getAll().then(function(rels){
        $scope.relationshipTypes = rels;    
        angular.forEach(rels, function(rel){
            $scope.relationships[rel.id] = rel;
        });
    });    
    
    //listen for the selected entity       
    $scope.$on('dashboardWidgets', function(event, args) { 
        $scope.selections = CurrentSelection.get();
        $scope.selectedTei = angular.copy($scope.selections.tei);
        $scope.trackedEntity = $scope.selections.te;
        $scope.selectedEnrollment = $scope.selections.enrollment;
    });
    
    $scope.showAddRelationship = function() {
        $rootScope.showAddRelationshipDiv = !$rootScope.showAddRelationshipDiv;
       
        if($rootScope.showAddRelationshipDiv){
            var modalInstance = $modal.open({
                templateUrl: 'components/relationship/add-relationship.html',
                controller: 'AddRelationshipController',
                windowClass: 'modal-full-window',
                resolve: {
                    relationshipTypes: function () {
                        return $scope.relationshipTypes;
                    },
                    selections: function () {
                        return $scope.selections;
                    },
                    selectedTei: function(){
                        return $scope.selectedTei;
                    }
                }
            });

            modalInstance.result.then(function (relationships) {
                $scope.selectedTei.relationships = relationships;           
            });
        }        
    };    
    
    $scope.showDashboard = function(rel){
        var relativeTeiId = '';
        if($scope.selectedTei.trackedEntityInstance === rel.trackedEntityInstanceA){
            relativeTeiId = rel.trackedEntityInstanceB;
        }
        else{
            relativeTeiId = rel.trackedEntityInstanceA;
        }          
                
        $location.path('/dashboard').search({tei: relativeTeiId, program: null}); 
        $route.reload();                                 
    };
})

//Controller for adding new relationship
.controller('AddRelationshipController', 
    function($scope, 
            $rootScope,
            CurrentSelection,
            OperatorFactory,
            AttributesFactory,
            EntityQueryFactory,
            ProgramFactory,
            TEIService,
            TEIGridService,
            DialogService,
            Paginator,
            storage,
            $modalInstance, 
            relationshipTypes,
            selections,
            selectedTei){
    
    $scope.relationshipTypes = relationshipTypes;
    $scope.selectedTei = selectedTei;
    $scope.relationshipSources = ['search_from_existing','register_new'];
    $scope.selectedRelationshipSource = {};   
    $scope.relationship = {};
    
    //Selection
    $scope.selectedOrgUnit = storage.get('SELECTED_OU');
    $scope.selectedTei = selections.tei;
    
    ProgramFactory.getAll().then(function(programs){
        $scope.programs = [];
        angular.forEach(programs, function(program){                            
            if(program.organisationUnits.hasOwnProperty($scope.selectedOrgUnit.id)){                                
                $scope.programs.push(program);
            }
        });

        if(angular.isObject($scope.programs) && $scope.programs.length === 1){
            $scope.selectedProgramForRelative = $scope.programs[0];
            AttributesFactory.getByProgram($scope.selectedProgramForRelative).then(function(atts){
                $scope.attributes = atts;
                $scope.attributes = $scope.generateAttributeFilters($scope.attributes);
                $scope.gridColumns = $scope.generateGridColumns($scope.attributes);
            });
        }   
        else{
            AttributesFactory.getWithoutProgram().then(function(atts){
                $scope.attributes = atts;
                $scope.attributes = $scope.generateAttributeFilters($scope.attributes);
                $scope.gridColumns = $scope.generateGridColumns($scope.attributes);
            });
        }
    });    
    
    //set attributes as per selected program
    $scope.setAttributesForSearch = function(program){
        $scope.selectedProgramForRelative = program;
        if( angular.isObject($scope.selectedProgramForRelative)){
            AttributesFactory.getByProgram($scope.selectedProgramForRelative).then(function(atts){
                $scope.attributes = atts;
                $scope.attributes = $scope.generateAttributeFilters($scope.attributes);
                $scope.gridColumns = $scope.generateGridColumns($scope.attributes);
            });
        }
        else{
            AttributesFactory.getWithoutProgram().then(function(atts){
                $scope.attributes = atts;
                $scope.attributes = $scope.generateAttributeFilters($scope.attributes);
                $scope.gridColumns = $scope.generateGridColumns($scope.attributes);
            });
        }
    };
    
    $scope.ouModes = [{name: 'SELECTED'}, {name: 'CHILDREN'}, {name: 'DESCENDANTS'}, {name: 'ACCESSIBLE'}];         
    $scope.selectedOuMode = $scope.ouModes[0];
    
    //Paging
    $scope.pager = {pageSize: 50, page: 1, toolBarDisplay: 5};   
    
    //EntityList
    $scope.showTrackedEntityDiv = false;
    
    //Searching
    $scope.showSearchDiv = false;
    $scope.searchText = {value: null};
    $scope.emptySearchText = false;
    $scope.searchFilterExists = false;   
    $scope.defaultOperators = OperatorFactory.defaultOperators;
    $scope.boolOperators = OperatorFactory.boolOperators;
    
    $scope.trackedEntityList = null; 
    $scope.enrollment = {programStartDate: '', programEndDate: '', operator: $scope.defaultOperators[0]};
   
    $scope.searchMode = {listAll: 'LIST_ALL', freeText: 'FREE_TEXT', attributeBased: 'ATTRIBUTE_BASED'};      
    
    //listen for selections
    $scope.$on('relationship', function(event, args) { 
        var relationshipInfo = CurrentSelection.getRelationshipInfo();
        $scope.teiForRelationship = relationshipInfo.tei;
    });

    $scope.search = function(mode){ 
        
        $scope.teiForRelationship = null;
        $scope.teiFetched = false;    
        $scope.emptySearchText = false;
        $scope.emptySearchAttribute = false;
        $scope.showSearchDiv = false;
        $scope.showRegistrationDiv = false;  
        $scope.showTrackedEntityDiv = false;
        $scope.trackedEntityList = null; 
        $scope.teiCount = null;

        $scope.queryUrl = null;
        $scope.programUrl = null;
        $scope.attributeUrl = {url: null, hasValue: false};
        
        $scope.selectedSearchMode = mode;        
   
        if($scope.selectedProgramForRelative){
            $scope.programUrl = 'program=' + $scope.selectedProgramForRelative.id;
        }        
        
        //check search mode
        if( $scope.selectedSearchMode === $scope.searchMode.freeText ){ 
            
            if(!$scope.searchText.value){                
                $scope.emptySearchText = true;
                $scope.teiFetched = false;   
                $scope.teiCount = null;
                return;
            }       
 
            $scope.queryUrl = 'query=' + $scope.searchText.value;                     
        }
        
        if( $scope.selectedSearchMode === $scope.searchMode.attributeBased ){            
            $scope.searchText.value = null;
            $scope.attributeUrl = EntityQueryFactory.getAttributesQuery($scope.attributes, $scope.enrollment);
            
            if(!$scope.attributeUrl.hasValue && !$scope.selectedProgramForRelative){
                $scope.emptySearchAttribute = true;
                $scope.teiFetched = false;   
                $scope.teiCount = null;
                return;
            }
        }
        
        $scope.doSearch();
    };
    
    $scope.doSearch = function(){

        //get events for the specified parameters
        TEIService.search($scope.selectedOrgUnit.id, 
                                            $scope.selectedOuMode.name,
                                            $scope.queryUrl,
                                            $scope.programUrl,
                                            $scope.attributeUrl.url,
                                            $scope.pager).then(function(data){
            //$scope.trackedEntityList = data;            
            if(data.rows){
                $scope.teiCount = data.rows.length;
            }                    
            
            if( data.metaData.pager ){
                $scope.pager = data.metaData.pager;
                $scope.pager.toolBarDisplay = 5;

                Paginator.setPage($scope.pager.page);
                Paginator.setPageCount($scope.pager.pageCount);
                Paginator.setPageSize($scope.pager.pageSize);
                Paginator.setItemCount($scope.pager.total);                    
            }
            
            //process tei grid
            $scope.trackedEntityList = TEIGridService.format(data,false, null);
            $scope.showTrackedEntityDiv = true;
            $scope.teiFetched = true;            
        });
    };
    
    $scope.jumpToPage = function(){
        $scope.search($scope.selectedSearchMode);
    };
    
    $scope.resetPageSize = function(){
        $scope.pager.page = 1;        
        $scope.search($scope.selectedSearchMode);
    };
    
    $scope.getPage = function(page){    
        $scope.pager.page = page;
        $scope.search($scope.selectedSearchMode);
    };
    
    $scope.generateAttributeFilters = function(attributes){

        angular.forEach(attributes, function(attribute){
            if(attribute.valueType === 'number' || attribute.valueType === 'date'){
                attribute.operator = $scope.defaultOperators[0];
            }
        });
                    
        return attributes;
    };

    //generate grid columns from teilist attributes
    $scope.generateGridColumns = function(attributes){

        var columns = attributes ? angular.copy(attributes) : [];
       
        //also add extra columns which are not part of attributes (orgunit for example)
        columns.push({id: 'orgUnitName', name: 'Organisation unit', type: 'string', displayInListNoProgram: false});
        columns.push({id: 'created', name: 'Registration date', type: 'string', displayInListNoProgram: false});
        
        //generate grid column for the selected program/attributes
        angular.forEach(columns, function(column){
            if(column.id === 'orgUnitName' && $scope.selectedOuMode.name !== 'SELECTED'){
                column.show = true;
            }
            
            if(column.displayInListNoProgram){
                column.show = true;
            }           
           
            if(column.type === 'date'){
                 $scope.filterText[column.id]= {start: '', end: ''};
            }
        });        
        return columns;        
    };   
    
    $scope.showHideSearch = function(simpleSearch){
        if(simpleSearch){
            $scope.showSearchDiv = false;
        }
        else{
            $scope.showSearchDiv = !$scope.showSearchDiv;
        }        
    };    
    
    $scope.close = function () {
        $modalInstance.close($scope.selectedTei.relationships ? $scope.selectedTei.relationships : []);
        $rootScope.showAddRelationshipDiv = !$rootScope.showAddRelationshipDiv;
    };
    
    $scope.assignRelationship = function(relativeTei){
        $scope.teiForRelationship = relativeTei;
        $rootScope.showAddRelationshipDiv = !$rootScope.showAddRelationshipDiv;
    };
    
    $scope.addRelationship = function(){
        if($scope.selectedTei && $scope.teiForRelationship && $scope.relationship.selected){

            var relationship = {relationship: $scope.relationship.selected.id, 
                                displayName: $scope.relationship.selected.name, 
                                trackedEntityInstanceA: $scope.selectedTei.trackedEntityInstance, 
                                trackedEntityInstanceB: $scope.teiForRelationship.id};
            
            if($scope.selectedTei.relationships){
                $scope.selectedTei.relationships.push(relationship);
            }
            else{
                $scope.selectedTei.relationships = [relationship];
            }
            
            TEIService.update($scope.selectedTei).then(function(response){
                if(response.status !== 'SUCCESS'){//update has failed
                    var dialogOptions = {
                            headerText: 'relationship_error',
                            bodyText: response.description
                        };
                    DialogService.showDialog({}, dialogOptions);
                    return;
                }
                
                $modalInstance.close($scope.selectedTei.relationships);                
            });
        }        
    };
})

.controller('RelativeRegistrationController', 
        function($rootScope,
                $scope,
                $timeout,
                AttributesFactory,
                ProgramFactory,
                TEService,
                TEIService,
                EnrollmentService,
                DialogService,
                CurrentSelection,
                DateUtils,
                storage,
                TranslationService) {

    //do translation of the registration page
    TranslationService.translate();   

    $scope.selectedOrgUnit = storage.get('SELECTED_OU');
    $scope.enrollment = {enrollmentDate: '', incidentDate: ''};    
    
    ProgramFactory.getAll().then(function(programs){
        $scope.programs = [];
        angular.forEach(programs, function(program){                            
            if(program.organisationUnits.hasOwnProperty($scope.selectedOrgUnit.id)){                                
                $scope.programs.push(program);
            }
        });

        if(angular.isObject($scope.programs) && $scope.programs.length === 1){
            $scope.selectedProgramForRelative = $scope.programs[0];
            AttributesFactory.getByProgram($scope.selectedProgramForRelative).then(function(atts){
                $scope.attributes = atts;
            });
        }                
    });
    
    //watch for selection of program
    $scope.$watch('selectedProgramForRelative', function() {        
        if( angular.isObject($scope.selectedProgramForRelative)){
            AttributesFactory.getByProgram($scope.selectedProgramForRelative).then(function(atts){
                $scope.attributes = atts;
            });
        }
        else{
            AttributesFactory.getWithoutProgram().then(function(atts){
                $scope.attributes = atts;
            });
        }
    }); 
            
    $scope.trackedEntities = {available: []};
    TEService.getAll().then(function(entities){
        $scope.trackedEntities.available = entities;   
        $scope.trackedEntities.selected = $scope.trackedEntities.available[0];
    });
    
    $scope.registerEntity = function(){
        
        //check for form validity
        $scope.outerForm.submitted = true;        
        if( $scope.outerForm.$invalid ){
            return false;
        }
        
        //form is valid, continue the registration
        //get selected entity
        var selectedTrackedEntity = $scope.trackedEntities.selected.id; 
        if($scope.selectedProgramForRelative){
            selectedTrackedEntity = $scope.selectedProgramForRelative.trackedEntity.id;
        }
        
        //get tei attributes and their values
        //but there could be a case where attributes are non-mandatory and
        //registration form comes empty, in this case enforce at least one value
        $scope.valueExists = false;
        var registrationAttributes = [];    
        angular.forEach($scope.attributes, function(attribute){
            if(!angular.isUndefined(attribute.value)){
                var att = {attribute: attribute.id, value: attribute.value};
                registrationAttributes.push(att);
                $scope.valueExists = true;
            } 
        });       
        
        if(!$scope.valueExists){
            //registration form is empty
            return false;
        }
        
        //prepare tei model and do registration
        $scope.tei = {trackedEntity: selectedTrackedEntity, orgUnit: $scope.selectedOrgUnit.id, attributes: registrationAttributes };   
        var teiId = '';
    
        TEIService.register($scope.tei).then(function(tei){
            
            if(tei.status === 'SUCCESS'){
                
                teiId = tei.reference;
                
                //registration is successful and check for enrollment
                if($scope.selectedProgramForRelative){    
                    //enroll TEI
                    var enrollment = {trackedEntityInstance: teiId,
                                program: $scope.selectedProgramForRelative.id,
                                status: 'ACTIVE',
                                dateOfEnrollment: DateUtils.formatFromUserToApi($scope.enrollment.enrollmentDate),
                                dateOfIncident: $scope.enrollment.incidentDate === '' ? DateUtils.formatFromUserToApi($scope.enrollment.enrollmentDate) : DateUtils.formatFromUserToApi($scope.enrollment.incidentDate)
                            };
                    EnrollmentService.enroll(enrollment).then(function(data){
                        if(data.status !== 'SUCCESS'){
                            //enrollment has failed
                            var dialogOptions = {
                                    headerText: 'enrollment_error',
                                    bodyText: data.description
                                };
                            DialogService.showDialog({}, dialogOptions);
                            return;
                        }
                    });
                }
            }
            else{
                //registration has failed
                var dialogOptions = {
                        headerText: 'registration_error',
                        bodyText: tei.description
                    };
                DialogService.showDialog({}, dialogOptions);
                return;
            }
            
            $timeout(function() { 
                //reset form
                angular.forEach($scope.attributes, function(attribute){
                    delete attribute.value;                
                });            

                $scope.enrollment.enrollmentDate = '';
                $scope.enrollment.incidentDate =  '';
                $scope.outerForm.submitted = false; 
                
                $scope.tei.id = teiId;
                $scope.broadCastSelections();
                
            }, 100);        
            
        });
    };
    
    $scope.resetRelationshipSource = function(){       
        $scope.selectedRelationshipSource.value = '';   
    };
    
    $scope.broadCastSelections = function(){
        if($scope.tei){
            angular.forEach($scope.tei.attributes, function(att){
                $scope.tei[att.attribute] = att.value;
            });

            $scope.tei.orgUnitName = $scope.selectedOrgUnit.name;
            $scope.tei.created = DateUtils.formatFromApiToUser(new Date());
            
            CurrentSelection.setRelationshipInfo({tei: $scope.tei, src: $scope.selectedRelationshipSource});
            
            $timeout(function() { 
                $rootScope.$broadcast('relationship', {});
            }, 100);
        }        
    };
});