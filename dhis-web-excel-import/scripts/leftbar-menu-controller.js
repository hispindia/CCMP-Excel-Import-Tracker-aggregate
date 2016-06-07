//Controller for column show/hide
trackerCapture.controller('LeftBarMenuController',
        function($scope,
                $location,
                TranslationService) {

    TranslationService.translate();
    
    $scope.showHome = function(){
        $location.path('/').search();
    };

    $scope.importData = function(){
       $location.path('/data-import').search();
    };

    $scope.importAggregateData = function(){
        $location.path('/aggregate-data-import').search();
    };

    $scope.showReportTypes = function(){
        $location.path('/report-types').search();
    };
});