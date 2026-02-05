module Ui
  class ModalComponent < ApplicationComponent
    renders_one :body
    renders_one :footer

    def initialize(title:, id:)
      @title = title
      @id = id
    end
  end
end
