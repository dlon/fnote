var hbSearchboxTemplate = Handlebars.compile($('#searchbox-template').html());
var searchHistoryTimer = 0;

function processJsonSearchData(data, searchStr, updateHistory=true) {
	let searchRes = $('<div class="search-results"></div>');
	$('#search-results-container').empty();
	for (let v of data) {
		// bolden matched text
		let matchIndex = v.response.toLowerCase().indexOf(searchStr.toLowerCase()),
			matchLen = searchStr.length;
		v.response = v.response.slice(0, matchIndex)
			+ "<strong>"+v.response.slice(matchIndex,matchIndex+matchLen)+"</strong>"
			+ v.response.slice(matchIndex+matchLen);
		// insert search result
		searchRes.append($(hbSearchboxTemplate(v)))
			.appendTo('#search-results-container');
	}
	// add hover effects
	$('.searchbox').hover(function(){
		$(this).animate({'background-color':"#eee"}, 200);
	}, function(){
		$(this).animate({'background-color':"#ddd"}, 200);
	});
	
	if (updateHistory) {
		if (searchHistoryTimer) {
			clearTimeout(searchHistoryTimer);
		}
		searchHistoryTimer = setTimeout(function() {
			window.history.pushState({
				inputValue:searchStr
			}, 'search', '/search?q='+encodeURIComponent(searchStr));
		}, 1000);
	}
}
function searchFor(str, updateHistory=true) {
	$.ajax('/api/search', {
		method: 'GET',
		dataType: 'json',
		data: {
			q: str,
			responseRadius: 50,
			maxNumResults: 10
		}
	}).done(function(data) {
		processJsonSearchData(data, str, updateHistory);
	});
}

$(document).ready(function() {
	$('[data-toggle="tooltip"]').tooltip();
	
	// search
	$('input[name="searchbar"]').keyup(function(ev) {
		if (ev.which === 13 || ev.which === 37 || ev.which === 38 || ev.which === 39 || ev.which === 40) {
			return;
		}
		searchFor($(this).val());
	});
	$('input[name="searchbar"]').focus(function(ev) {
		$('.search-results').show();
	});
	// hide search results when clicking outside the search area
	$(document).mouseup(function (e) {
		var elem = $('#search-wrapper');
		if (!elem.is(e.target) && elem.has(e.target).length === 0) {
			elem = $('.search-results'); // using #search-wrapper
			/*elem.hide(function(){
				$(this).remove();
			});*/
			elem.hide({});
		}
	});
	
	tinymce.init({
		selector: '#tinymce-area',
		//height: 500,
		theme: 'modern',
		//skin: 'light',
		skin: 'custom', // NOTE: created using skin.tinymce.com
		menubar:false,
		image_caption:true,
		plugins: [
			'advlist autolink lists link image charmap print hr anchor pagebreak',
			'searchreplace wordcount visualblocks visualchars code fullscreen',
			'insertdatetime media nonbreaking save table contextmenu directionality',
			'template paste textcolor colorpicker textpattern imagetools codesample toc'
		],
		// fullpage: metadata
		//toolbar: 'undo redo | styleselect | formats | bold italic unline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media | forecolor backcolor | codesample code print', //  insert | styleselect
		//toolbar2: 'print preview | forecolor backcolor | codesample code',
		toolbar: "undo redo | styleselect | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent table | link image media | codesample code print insert fullscreen", // symbols disappeared in 'light' - obsolete?
		image_advtab: true,
		templates: [
			{ title: 'Test template 1', content: 'Test 1' },
			{ title: 'Test template 2', content: 'Test 2' }
		],
		//fixed_toolbar_container:'#toolbar-container',
		/*content_css: [
			'https://fast.fonts.net/cssapi/e6dc9b99-64fe-4292-ad98-6974f93cd2a2.css',
			'https://www.tinymce.com/css/codepen.min.css' // FIXME: how do i set the font normally?
		],*/
		content_css: [
			'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css',
			'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap-theme.min.css'
		],
		//content_style: ".mce-content-body{font-family:'Open Sans', sans-serif;font-size:14px}",
		content_style: ".mce-content-body{font-size:1.8em; padding:30px}", // works well with bootstrap css
		end_container_on_empty_block: true
	});
	// FIXME: header editor
	/*
	var quillTitle = new Quill('#document-title', {
		modules: {
			toolbar: false,
			syntax: true, // FIXME: it gets stuck without this
			keyboard: {
				bindings: {
					'enter': { // disable line insertion
						key: 13,
						handler: function() {
							return false; // FIXME: when tabbing into cursor=0, a line break is still added
						}
					},
					'tab': {
						key: 9,
						handler: function() {
							return true;
						}
					}
				}
			}
		},
		placeholder: 'Title',
		theme: 'snow'
	});
	*/
	
	window.onpopstate = function(ev) {
		// TODO: cache the search results?
		if (ev.state) {
			$('input[name="searchbar"]').val(ev.state.inputValue);
			searchFor(ev.state.inputValue, updateHistory = false);
		} else {
			$('input[name="searchbar"]').val('');
			$('.search-results').hide(function(){
				$(this).remove();
			});
		}
	};
});