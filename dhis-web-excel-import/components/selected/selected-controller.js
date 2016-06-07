trackerCapture.controller('SelectedInfoController',
        function($scope,                
                storage,
                CurrentSelection,
                TranslationService) {

    TranslationService.translate();
    
    //listen for the selected items
    $scope.$on('selectedItems', function(event, args) {
        
        var selections = CurrentSelection.get();
        $scope.selectedEntity = selections.tei; 
        $scope.selectedProgram = selections.pr; 
        
        $scope.selectedOrgUnit = storage.get('SELECTED_OU');
        $scope.selections = [];
        
        $scope.selections.push({title: 'registering_unit', value: $scope.selectedOrgUnit ? $scope.selectedOrgUnit.name : 'not_selected'});
        $scope.selections.push({title: 'program', value: $scope.selectedProgram ? $scope.selectedProgram.name : 'not_selected'});               
        
    });     
});