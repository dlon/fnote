var searchHistoryTimer = 0;
var hbSearchboxTemplate;

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
			}, 'search', '');
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
	hbSearchboxTemplate = Handlebars.compile($('#searchbox-template').html());
	
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
			'template paste textcolor colorpicker textpattern imagetools codesample toc',
			//'autoresize'
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
		/* INLINING (INLINING|AUTORESIZE) */
		inline:true,
		fixed_toolbar_container:'#toolbar-container',
		autofocus:true,
		init_instance_callback: function() {
			tinymce.activeEditor.focus();
		},
		setup: function (editor) {
			editor.on('blur', function () {
					return false;
			});
		},
		/* [END INLINING HERE] */
		/* AUTORESIZE (INLINING|AUTORESIZE). (instead of inlining) - cf. also plugin */
		/*autoresize_bottom_padding:0,
		content_css: [
			"http://fonts.googleapis.com/css?family=Open+Sans:300,400",
			"https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css",
			"https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap-theme.min.css",
			"static/freenote.css"
		],
		content_style: ".mce-content-body{padding:20px;font-size:1.8em}",*/
		/* [END AUTORESIZE STYLE] */
		end_container_on_empty_block: true
	});
	
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