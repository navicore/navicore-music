use yew::prelude::{Html, function_component, html};

#[function_component(App)]
pub fn app() -> Html {
    html! {
        <div>
            <h1>{ "Navicore Music" }</h1>
            <p>{ "Welcome to the Navicore Music application!" }</p>
        </div>
    }
}

#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn run_app() {
    yew::Renderer::<App>::new().render();
}
